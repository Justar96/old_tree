import { z } from 'zod';
import * as path from 'path';
import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { ParameterValidator } from '../core/validator.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
import { SearchParams, SearchResult } from '../types/schemas.js';

export class SearchTool {
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

  async execute(params: SearchParams): Promise<SearchResult> {
    const startTime = Date.now();

    // Validate parameters
    const validation = this.validator.validateSearchParams(params);
    if (!validation.valid) {
      throw new ValidationError('Invalid search parameters', {
        errors: validation.errors,
        params
      });
    }

    const sanitizedParams = validation.sanitized as SearchParams;

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

    try {
      // Build ast-grep command arguments
      const args = this.buildSearchArgs(sanitizedParams, pathValidation.resolvedPaths);

      // Execute ast-grep (stdin if code provided)
      let result;
      if (sanitizedParams.code) {
        const stdinArgs = [...args];
        stdinArgs.push('--stdin');
        if (sanitizedParams.stdinFilepath) {
          stdinArgs.push('--stdin-filepath', sanitizedParams.stdinFilepath);
        }
        // ast-grep expects language for stdin to parse correctly
        if (sanitizedParams.language) {
          // already added earlier
        }
        result = await this.binaryManager.executeAstGrep(stdinArgs, {
          cwd: this.workspaceManager.getWorkspaceRoot(),
          timeout: sanitizedParams.timeoutMs ?? 30000, // 30 seconds
          stdin: sanitizedParams.code
        });
        // Inject provided code into result parsing context via stdout (ast-grep reads from stdin internally)
      } else {
        result = await this.binaryManager.executeAstGrep(args, {
          cwd: this.workspaceManager.getWorkspaceRoot(),
          timeout: sanitizedParams.timeoutMs ?? 30000 // 30 seconds
        });
      }

      // Parse results
      const matches = this.parseSearchResults(result.stdout, sanitizedParams, this.workspaceManager.getWorkspaceRoot());
      const filesScanned = this.extractFilesScanned(result.stderr, matches);

      return {
        matches: matches.slice(0, sanitizedParams.maxMatches),
        summary: {
          totalMatches: matches.length,
          filesScanned,
          language: sanitizedParams.language,
          executionTime: Date.now() - startTime
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
        `Search execution failed: ${friendlyMessage}`,
        { params: sanitizedParams, originalError: error }
      );
    }
  }

  private buildSearchArgs(params: SearchParams, resolvedPaths: string[]): string[] {
    const args: string[] = ['run'];

    // Add pattern (required)
    args.push('--pattern', params.pattern);

    // Add language filter if specified (required for ast-grep)
    if (params.language) {
      args.push('--lang', params.language);
    }

    // Add context
    if (params.context && params.context > 0) {
      args.push('--context', params.context.toString());
    }

    // Add include patterns using globs
    if (params.include && params.include.length > 0) {
      for (const pattern of params.include) {
        args.push('--globs', pattern);
      }
    }

    // Add exclude patterns (ast-grep uses --globs with ! prefix for exclusion)
    if (params.exclude && params.exclude.length > 0) {
      for (const pattern of params.exclude) {
        args.push('--globs', `!${pattern}`);
      }
    }

    // Respect ignore settings
    if (params.noIgnore) {
      args.push('--no-ignore');
    }
    if (params.ignorePath && params.ignorePath.length > 0) {
      for (const ig of params.ignorePath) {
        args.push('--ignore-path', ig);
      }
    }

    // Root/workdir controls (if provided)
    if (params.root) {
      args.push('--root', params.root);
    }
    if (params.workdir) {
      args.push('--workdir', params.workdir);
    }

    // Add JSON output for parsing
    args.push(`--json=${params.jsonStyle || 'stream'}`);

    // Follow symlinks
    if (params.follow) {
      args.push('--follow');
    }

    // Threads
    if (params.threads) {
      args.push('--threads', String(params.threads));
    }

    // Add paths when not using stdin
    if (!params.code) {
      args.push(...resolvedPaths);
    }

    return args;
  }

  private parseSearchResults(stdout: string, params: SearchParams, workspaceRoot: string): SearchResult['matches'] {
    const matches: SearchResult['matches'] = [];
    const perFileLimit = params.perFileMatchLimit ?? undefined;
    const fileToCount = new Map<string, number>();

    if (!stdout.trim()) {
      return matches;
    }

    try {
      if ((params.jsonStyle || 'stream') === 'stream') {
        // JSONL
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          this.processJsonRecord(JSON.parse(line), matches, fileToCount, perFileLimit, params, workspaceRoot);
        }
      } else {
        // Non-stream: expect JSON array or object with matches
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          for (const record of parsed) {
            this.processJsonRecord(record, matches, fileToCount, perFileLimit, params, workspaceRoot);
          }
        } else {
          this.processJsonRecord(parsed, matches, fileToCount, perFileLimit, params, workspaceRoot);
        }
      }
    } catch (error) {
      // If JSON parsing fails, try to extract basic information
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to parse ast-grep JSON output:', errorMessage);
    }

    return matches;
  }

  private processJsonRecord(result: any, matches: SearchResult['matches'], fileToCount: Map<string, number>, perFileLimit: number | undefined, params: SearchParams, workspaceRoot: string): void {
    if (result.matches) {
      for (const match of result.matches) {
        const parsed = this.parseSingleMatch(match, params, workspaceRoot);
        if (perFileLimit) {
          const current = fileToCount.get(parsed.file) || 0;
          if (current >= perFileLimit) continue;
          fileToCount.set(parsed.file, current + 1);
        }
        matches.push(parsed);
      }
    } else if (result.file) {
      const parsed = this.parseSingleMatch(result, params, workspaceRoot);
      if (perFileLimit) {
        const current = fileToCount.get(parsed.file) || 0;
        if (current < perFileLimit) {
          fileToCount.set(parsed.file, current + 1);
          matches.push(parsed);
        }
      } else {
        matches.push(parsed);
      }
    }
  }

  private parseSingleMatch(match: any, params: SearchParams, workspaceRoot: string): SearchResult['matches'][0] {
    let filePath: string = match.file || '';
    if (params.relativePaths && filePath) {
      try {
        const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
        const rel = path.relative(workspaceRoot, abs) || filePath;
        filePath = rel.replace(/\\/g, '/');
      } catch {
        // keep original on failure
      }
    }

    // Extract captures if available from ast-grep JSON
    const captures = Array.isArray(match.captures) ? match.captures.map((c: any) => ({
      name: String(c.name ?? ''),
      text: c.text,
      startLine: c.range?.start?.line !== undefined ? Number(c.range.start.line) + 1 : undefined,
      startColumn: c.range?.start?.column !== undefined ? Number(c.range.start.column) : undefined,
      endLine: c.range?.end?.line !== undefined ? Number(c.range.end.line) + 1 : undefined,
      endColumn: c.range?.end?.column !== undefined ? Number(c.range.end.column) : undefined,
    })) : undefined;

    return {
      file: filePath,
      line: match.range?.start?.line !== undefined ? Number(match.range.start.line) + 1 : 0, // ast-grep uses 0-based lines
      column: match.range?.start?.column !== undefined ? Number(match.range.start.column) : 0,
      endLine: match.range?.end?.line !== undefined ? Number(match.range.end.line) + 1 : undefined,
      endColumn: match.range?.end?.column !== undefined ? Number(match.range.end.column) : undefined,
      text: match.text || match.lines || '',
      context: {
        before: match.context?.before || [],
        after: match.context?.after || []
      },
      matchedNode: match.text || match.lines || '',
      captures
    };
  }

  private extractFilesScanned(stderr: string, matches: SearchResult['matches']): number {
    // Try to extract file count from stderr
    const fileCountMatch = stderr.match(/(\d+)\s+files?\s+searched/i);
    if (fileCountMatch) {
      return parseInt(fileCountMatch[1], 10);
    }

    // Fallback: count unique files from matches
    const unique = new Set(matches.map(m => m.file));
    return unique.size || 0;
  }

  // Get tool schema for MCP
  static getSchema() {
    return {
      name: 'ast_search',
      description: 'Perform structural code search using AST patterns',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'AST pattern to search for. Examples: "console.log($_)" for function calls, "function $NAME($ARGS) { $$$ }" for function definitions, "import $WHAT from $WHERE" for imports'
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files/directories to search (default: current directory)'
          },
          language: {
            type: 'string',
            description: 'Programming language hint for better pattern matching. Supported: javascript, typescript, python, java, rust, go, cpp, etc. Auto-detected from pattern if not specified'
          },
          context: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            default: 3,
            description: 'Lines of context around matches'
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
          },
          maxMatches: {
            type: 'number',
            minimum: 1,
            maximum: 10000,
            default: 100,
            description: 'Maximum number of matches to return'
          },
          jsonStyle: {
            type: 'string',
            enum: ['stream', 'pretty', 'compact'],
            default: 'stream',
            description: 'JSON output format to request from ast-grep'
          },
          follow: {
            type: 'boolean',
            default: false,
            description: 'Follow symlinks during search'
          },
          threads: {
            type: 'number',
            minimum: 1,
            maximum: 64,
            description: 'Number of threads to use'
          },
          timeoutMs: {
            type: 'number',
            minimum: 1000,
            maximum: 120000,
            description: 'Timeout for ast-grep execution in milliseconds (default 30000)'
          },
          relativePaths: {
            type: 'boolean',
            default: false,
            description: 'Return file paths relative to workspace root'
          },
          perFileMatchLimit: {
            type: 'number',
            minimum: 1,
            maximum: 1000,
            description: 'Limit number of matches per file'
          },
          noIgnore: {
            type: 'boolean',
            default: false,
            description: 'Disable ignore rules (use carefully)'
          },
          ignorePath: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional ignore file(s) to respect'
          },
          root: {
            type: 'string',
            description: 'Override project root used by ast-grep'
          },
          workdir: {
            type: 'string',
            description: 'Working directory for ast-grep'
          },
          code: {
            type: 'string',
            description: 'Search code provided via stdin instead of reading files (requires language)'
          },
          stdinFilepath: {
            type: 'string',
            description: 'Virtual filepath for stdin content, used for language/ignore resolution'
          }
        },
        required: ['pattern']
      }
    };
  }
}