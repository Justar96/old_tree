import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { SecurityError } from '../types/errors.js';

export interface WorkspaceConfig {
  root: string;
  allowedPaths: string[];
  blockedPaths: string[];
  maxDepth: number;
}

export class WorkspaceManager {
  private config: WorkspaceConfig;

  constructor(explicitRoot?: string) {
    this.config = this.detectWorkspace(explicitRoot);
  }

  private detectWorkspace(explicitRoot?: string): WorkspaceConfig {
    let workspaceRoot: string;

    if (explicitRoot) {
      workspaceRoot = path.resolve(explicitRoot);
    } else {
      // Auto-detect workspace root
      workspaceRoot = this.autoDetectWorkspaceRoot();
    }

    return {
      root: workspaceRoot,
      allowedPaths: [],
      blockedPaths: this.getBlockedPaths(),
      maxDepth: 10,
    };
  }

  private autoDetectWorkspaceRoot(): string {
    let currentDir = process.cwd();

    // Look for common project root indicators
    const rootIndicators = [
      '.git',
      'package.json',
      'Cargo.toml',
      'pyproject.toml',
      'go.mod',
      'composer.json',
      'Gemfile',
      'Makefile',
      'README.md',
      '.vscode',
      '.idea'
    ];

    // Check current directory first
    for (const indicator of rootIndicators) {
      try {
        fsSync.accessSync(path.join(currentDir, indicator));
        return currentDir; // Found indicator in current directory
      } catch {
        // Indicator not found, continue
      }
    }

    // Walk up directories looking for indicators
    let parentDir = path.dirname(currentDir);
    let depth = 0;
    const maxDepth = 5;

    while (parentDir !== currentDir && depth < maxDepth) {
      for (const indicator of rootIndicators) {
        try {
          fsSync.accessSync(path.join(parentDir, indicator));
          return parentDir; // Found indicator in parent directory
        } catch {
          // Indicator not found, continue
        }
      }

      currentDir = parentDir;
      parentDir = path.dirname(currentDir);
      depth++;
    }

    // Fallback to current working directory
    return process.cwd();
  }

  private getBlockedPaths(): string[] {
    const systemPaths = [
      '/etc', '/bin', '/usr', '/sys', '/proc',           // Unix system dirs
      'C:\\Windows', 'C:\\Program Files',               // Windows system dirs
      path.join(process.env.HOME || '', '.ssh'),        // SSH keys
      path.join(process.env.HOME || '', '.aws'),        // AWS credentials
      'node_modules/.bin',                              // Binary executables
      '.git',                                           // Git internal files
    ];

    return systemPaths.map(p => path.resolve(p));
  }

  getConfig(): WorkspaceConfig {
    return { ...this.config };
  }

  getWorkspaceRoot(): string {
    return this.config.root;
  }

  validatePath(inputPath: string): { valid: boolean; resolvedPath: string; error?: string } {
    try {
      // Resolve the path relative to workspace root
      const resolvedPath = path.resolve(this.config.root, inputPath);

      // Ensure the resolved path is within the workspace root
      if (!resolvedPath.startsWith(this.config.root)) {
        return {
          valid: false,
          resolvedPath,
          error: `Path "${inputPath}" is outside workspace root`
        };
      }

      // Check against blocked paths
      for (const blockedPath of this.config.blockedPaths) {
        if (resolvedPath.startsWith(blockedPath)) {
          return {
            valid: false,
            resolvedPath,
            error: `Access to system directory "${inputPath}" is blocked`
          };
        }
      }

      // Check depth limit
      const relativePath = path.relative(this.config.root, resolvedPath);
      const depth = relativePath.split(path.sep).length;

      if (depth > this.config.maxDepth) {
        return {
          valid: false,
          resolvedPath,
          error: `Path depth (${depth}) exceeds maximum allowed depth (${this.config.maxDepth})`
        };
      }

      return {
        valid: true,
        resolvedPath
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        resolvedPath: inputPath,
        error: `Invalid path: ${errorMessage}`
      };
    }
  }

  validatePaths(inputPaths: string[]): { valid: boolean; resolvedPaths: string[]; errors: string[] } {
    const resolvedPaths: string[] = [];
    const errors: string[] = [];
    let allValid = true;

    for (const inputPath of inputPaths) {
      const validation = this.validatePath(inputPath);
      if (validation.valid) {
        resolvedPaths.push(validation.resolvedPath);
      } else {
        allValid = false;
        errors.push(validation.error || `Invalid path: ${inputPath}`);
      }
    }

    return {
      valid: allValid,
      resolvedPaths,
      errors
    };
  }

  // Get all files in the workspace (with safety limits)
  async getWorkspaceFiles(options: {
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFiles?: number;
  } = {}): Promise<string[]> {
    const {
      includePatterns = [],
      excludePatterns = ['node_modules', '.git', 'build', 'dist'],
      maxFiles = 10000
    } = options;

    const files: string[] = [];
    const visited = new Set<string>();

    const scanDirectory = async (dirPath: string, currentDepth = 0): Promise<void> => {
      if (currentDepth > this.config.maxDepth) return;
      if (files.length >= maxFiles) return;

      try {
        const items = await fs.readdir(dirPath);

        for (const item of items) {
          if (files.length >= maxFiles) break;

          const itemPath = path.join(dirPath, item);
          const relativePath = path.relative(this.config.root, itemPath);

          // Skip if already visited (symlink protection)
          if (visited.has(itemPath)) continue;
          visited.add(itemPath);

          // Check exclude patterns
          if (excludePatterns.some(pattern => {
            return relativePath.includes(pattern) ||
                   item.startsWith('.') && pattern === '.*';
          })) {
            continue;
          }

          const stats = await fs.stat(itemPath);

          if (stats.isFile()) {
            // Check include patterns if specified
            if (includePatterns.length === 0 ||
                includePatterns.some(pattern => relativePath.includes(pattern))) {
              files.push(itemPath);
            }
          } else if (stats.isDirectory()) {
            await scanDirectory(itemPath, currentDepth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scanDirectory(this.config.root);

    return files;
  }

  private async countFilesRecursive(dir: string, currentDepth = 0): Promise<number> {
    if (currentDepth > this.config.maxDepth) return 0;

    let count = 0;
    try {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        try {
          const stats = await fs.stat(itemPath);

          if (stats.isFile()) {
            count++;
          } else if (stats.isDirectory() && !item.startsWith('.')) {
            count += await this.countFilesRecursive(itemPath, currentDepth + 1);
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }

    return count;
  }
}