import * as path from 'path';
import * as fs from 'fs/promises';

export interface ResolvedPaths {
  workspace: string;
  targets: string[];
  errors: string[];
}

export class PathResolver {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async resolvePaths(inputPaths?: string[]): Promise<ResolvedPaths> {
    const resolved: ResolvedPaths = {
      workspace: this.workspaceRoot,
      targets: [],
      errors: []
    };

    // Default to current workspace if no paths provided
    const pathsToResolve = inputPaths && inputPaths.length > 0
      ? inputPaths
      : ['.'];

    for (const inputPath of pathsToResolve) {
      try {
        // Enhanced path normalization with better handling
        const normalizedPath = this.normalizePath(inputPath);

        // Improved path resolution with absolute path detection
        let resolvedPath: string;
        if (path.isAbsolute(normalizedPath)) {
          // For absolute paths, use as-is but validate
          resolvedPath = normalizedPath;
        } else {
          // For relative paths, resolve against workspace
          resolvedPath = path.resolve(this.workspaceRoot, normalizedPath);
        }

        // Enhanced workspace validation with better error messages
        if (!this.isWithinWorkspace(resolvedPath)) {
          const relativePath = path.relative(this.workspaceRoot, resolvedPath);
          resolved.errors.push(
            `Path "${inputPath}" resolves outside workspace boundary. ` +
            `Resolved to: ${resolvedPath} ` +
            `(${relativePath} relative to workspace ${this.workspaceRoot}). ` +
            `Use paths within workspace or adjust workspace root.`
          );
          continue;
        }

        // Enhanced existence check with detailed error information
        try {
          const stats = await fs.stat(resolvedPath);

          // Provide helpful information about what was found
          if (stats.isDirectory()) {
            // For directories, ensure they contain searchable files
            resolved.targets.push(resolvedPath);
          } else if (stats.isFile()) {
            // For files, add directly
            resolved.targets.push(resolvedPath);
          } else {
            resolved.errors.push(
              `Path "${inputPath}" exists but is neither a file nor directory: ${resolvedPath}`
            );
          }
        } catch (accessError) {
          // Provide specific error for missing paths with suggestions
          const suggestions = this.getSuggestionsForMissingPath(inputPath, resolvedPath);
          resolved.errors.push(
            `Path not accessible: "${inputPath}" (resolved to: ${resolvedPath}). ` +
            `${suggestions}`
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        resolved.errors.push(`Invalid path "${inputPath}": ${errorMessage}`);
      }
    }

    return resolved;
  }

  /**
   * Synchronous path resolution for cases where file existence isn't critical
   */
  resolvePathsSync(inputPaths?: string[]): ResolvedPaths {
    const resolved: ResolvedPaths = {
      workspace: this.workspaceRoot,
      targets: [],
      errors: []
    };

    const pathsToResolve = inputPaths && inputPaths.length > 0
      ? inputPaths
      : ['.'];

    for (const inputPath of pathsToResolve) {
      try {
        const normalizedPath = this.normalizePath(inputPath);
        const resolvedPath = path.isAbsolute(normalizedPath)
          ? normalizedPath
          : path.resolve(this.workspaceRoot, normalizedPath);

        if (!this.isWithinWorkspace(resolvedPath)) {
          const relativePath = path.relative(this.workspaceRoot, resolvedPath);
          resolved.errors.push(
            `Path "${inputPath}" is outside workspace: ${this.workspaceRoot} ` +
            `(resolves to ${relativePath})`
          );
          continue;
        }

        resolved.targets.push(resolvedPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        resolved.errors.push(`Invalid path "${inputPath}": ${errorMessage}`);
      }
    }

    return resolved;
  }

  private isWithinWorkspace(targetPath: string): boolean {
    try {
      const relativePath = path.relative(this.workspaceRoot, targetPath);
      return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    } catch {
      return false;
    }
  }

  /**
   * Get workspace-relative path for display purposes
   */
  getRelativePath(absolutePath: string): string {
    try {
      const relativePath = path.relative(this.workspaceRoot, absolutePath);
      return relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency
    } catch {
      return absolutePath;
    }
  }

  /**
   * Enhanced path normalization with cross-platform support
   */
  private normalizePath(inputPath: string): string {
    // Handle empty or whitespace-only paths
    const trimmed = inputPath.trim();
    if (!trimmed) {
      return '.';
    }

    // Normalize path separators for cross-platform compatibility
    let normalized = trimmed.replace(/[\\\/]+/g, path.sep);

    // Remove trailing separators except for root paths
    if (normalized.length > 1 && normalized.endsWith(path.sep)) {
      normalized = normalized.slice(0, -1);
    }

    // Handle special cases
    if (normalized === '.' || normalized === '') {
      return '.';
    }

    return normalized;
  }

  /**
   * Provide helpful suggestions for missing paths
   */
  private getSuggestionsForMissingPath(inputPath: string, resolvedPath: string): string {
    const suggestions: string[] = [];

    // Check if it's a case sensitivity issue
    const dirname = path.dirname(resolvedPath);
    const basename = path.basename(resolvedPath);

    try {
      const fs = require('fs');
      if (fs.existsSync(dirname)) {
        const files = fs.readdirSync(dirname);
        const similarFiles = files.filter((file: string) =>
          file.toLowerCase() === basename.toLowerCase() && file !== basename
        );

        if (similarFiles.length > 0) {
          suggestions.push(`Did you mean: ${similarFiles[0]}?`);
        }
      }
    } catch {
      // Ignore errors in suggestion generation
    }

    // Check if user provided relative path when absolute was expected
    if (!path.isAbsolute(inputPath) && inputPath.includes('/') || inputPath.includes('\\')) {
      suggestions.push('For file-based operations, consider using absolute paths.');
    }

    // Suggest using inline code instead
    suggestions.push('For most reliable results, use the "code" parameter for inline search.');

    return suggestions.length > 0 ? suggestions.join(' ') : 'Check path spelling and permissions.';
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}