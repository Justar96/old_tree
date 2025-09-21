import * as fs from 'fs/promises';
import * as path from 'path';
import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { ParameterValidator } from '../core/validator.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ValidationError, ExecutionError, SecurityError } from '../types/errors.js';
import { ReplaceParams, ReplaceResult } from '../types/schemas.js';

export class ReplaceTool {
  private binaryManager: AstGrepBinaryManager;
  private validator: ParameterValidator;
  private workspaceManager: WorkspaceManager;

  constructor(
    binaryManager: AstGrepBinaryManager,
    workspaceManager: WorkspaceManager
  ) {
    this.binaryManager = binaryManager;
    this.workspaceManager = workspaceManager;
    this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
  }

  async execute(params: ReplaceParams): Promise<ReplaceResult> {
    // Validate parameters
    const validation = this.validator.validateReplaceParams(params);
    if (!validation.valid) {
      throw new ValidationError('Invalid replace parameters', {
        errors: validation.errors,
        params
      });
    }

    const sanitizedParams = validation.sanitized as ReplaceParams;

    // Validate resource limits
    const resourceValidation = await this.validator.validateResourceLimits(sanitizedParams.paths || ['.']);
    if (!resourceValidation.valid) {
      throw new ValidationError('Resource limits exceeded', {
        errors: resourceValidation.errors,
        params: sanitizedParams
      });
    }

    // Validate paths
    const pathValidation = this.workspaceManager.validatePaths(sanitizedParams.paths || ['.']);
    if (!pathValidation.valid) {
      throw new ValidationError('Invalid paths', {
        errors: pathValidation.errors,
        params: sanitizedParams
      });
    }

    // For non-dry-run operations, create backups
    if (!sanitizedParams.dryRun) {
      await this.createBackups(pathValidation.resolvedPaths);
    }

    try {
      // Build ast-grep command arguments
      const args = this.buildReplaceArgs(sanitizedParams, pathValidation.resolvedPaths);

      // Execute ast-grep
      const result = await this.binaryManager.executeAstGrep(args, {
        cwd: this.workspaceManager.getWorkspaceRoot(),
        timeout: sanitizedParams.dryRun ? 30000 : 60000 // Longer timeout for actual replacements
      });

      // Parse results
      const changes = this.parseReplaceResults(result.stdout, sanitizedParams.dryRun);

      return {
        changes,
        summary: {
          totalChanges: changes.reduce((sum, change) => sum + change.matches, 0),
          filesModified: changes.filter(change => change.applied).length,
          dryRun: sanitizedParams.dryRun
        }
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Try to translate ast-grep errors to user-friendly messages
      const friendlyMessage = this.validator.translateAstGrepError(errorMessage);

      throw new ExecutionError(
        `Replace execution failed: ${friendlyMessage}`,
        { params: sanitizedParams, originalError: error }
      );
    }
  }

  private async createBackups(paths: string[]): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.workspaceManager.getWorkspaceRoot(), '.ast-grep-backups', timestamp);

    try {
      await fs.mkdir(backupDir, { recursive: true });

      for (const filePath of paths) {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          const relativePath = path.relative(this.workspaceManager.getWorkspaceRoot(), filePath);
          const backupPath = path.join(backupDir, relativePath);
          await fs.mkdir(path.dirname(backupPath), { recursive: true });
          await fs.copyFile(filePath, backupPath);
        }
      }
    } catch (error) {
      // Log warning but don't fail the operation
      console.warn('Failed to create backups:', error);
    }
  }

  private buildReplaceArgs(params: ReplaceParams, resolvedPaths: string[]): string[] {
    const args: string[] = ['run'];

    // Add pattern (required)
    args.push('--pattern', params.pattern);

    // Add replacement
    args.push('--rewrite', params.replacement);

    // Add language filter if specified
    if (params.language) {
      args.push('--lang', params.language);
    }

    // Add include patterns using globs
    if (params.include && params.include.length > 0) {
      for (const pattern of params.include) {
        args.push('--globs', pattern);
      }
    }

    // Add exclude patterns
    if (params.exclude && params.exclude.length > 0) {
      for (const pattern of params.exclude) {
        args.push('--globs', `!${pattern}`);
      }
    }

    // Interactive mode - ast-grep has built-in interactive support
    if (params.interactive && !params.dryRun) {
      args.push('--interactive');
    } else if (!params.dryRun) {
      // For non-interactive, non-dry-run mode, use update-all
      args.push('--update-all');
    }

    // JSON output for parsing
    args.push('--json=stream');

    // Add paths (must come after options)
    args.push(...resolvedPaths);

    return args;
  }

  private parseReplaceResults(stdout: string, isDryRun: boolean): ReplaceResult['changes'] {
    const changes: ReplaceResult['changes'] = [];

    if (!stdout.trim()) {
      return changes;
    }

    try {
      // ast-grep outputs one JSON object per line
      const lines = stdout.trim().split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const result = JSON.parse(line);

        // Handle different ast-grep output formats
        if (result.changes) {
          // Multiple changes in one result
          for (const change of result.changes) {
            changes.push(this.parseSingleChange(change, isDryRun));
          }
        } else if (result.file) {
          // Single change
          changes.push(this.parseSingleChange(result, isDryRun));
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to parse ast-grep JSON output:', errorMessage);
      // Fallback: try to extract basic information from stdout
      const fileMatches = stdout.match(/(\d+)\s+matches?\s+in\s+([^\n]+)/g);
      if (fileMatches) {
        for (const match of fileMatches) {
          const [, count, file] = match.match(/(\d+)\s+matches?\s+in\s+(.+)/) || [];
          if (count && file) {
            changes.push({
              file: file.trim(),
              matches: parseInt(count, 10),
              applied: !isDryRun,
              preview: isDryRun ? `Would modify ${count} matches in ${file}` : undefined
            });
          }
        }
      }
    }

    return changes;
  }

  private parseSingleChange(change: any, isDryRun: boolean): ReplaceResult['changes'][0] {
    return {
      file: change.file || change.path || '',
      matches: change.matches || change.count || 0,
      preview: isDryRun ? change.preview || change.diff : undefined,
      applied: !isDryRun && (change.applied !== false)
    };
  }

  // Get tool schema for MCP
  static getSchema() {
    return {
      name: 'ast_replace',
      description: 'Perform structural find-and-replace operations using AST patterns',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'AST pattern to match. Use metavariables like $VAR to capture code elements. Examples: "console.log($_)" to match any console.log call'
          },
          replacement: {
            type: 'string',
            description: 'Replacement template using same metavariables as pattern. Examples: "logger.info($_)" to replace console.log($_) with logger.info($_)'
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files/directories to process (default: current directory)'
          },
          language: {
            type: 'string',
            description: 'Programming language hint for better pattern matching. Auto-detected from pattern if not specified'
          },
          dryRun: {
            type: 'boolean',
            default: true,
            description: 'Preview changes without applying them'
          },
          interactive: {
            type: 'boolean',
            default: false,
            description: 'Require confirmation for each change (currently treated as dry-run)'
          },
          include: {
            type: 'array',
            items: { type: 'string' },
            description: 'Include glob patterns'
          },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exclude glob patterns (default: node_modules, .git, dist, build, coverage, *.min.js)'
          }
        },
        required: ['pattern', 'replacement']
      }
    };
  }
}