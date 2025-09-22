import { z } from 'zod';
import * as path from 'path';
import * as fsSync from 'fs';
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

    // Skip resource and path validation for inline code searches
    let pathValidation: any = { valid: true, resolvedPaths: [] };
    
    if (!sanitizedParams.code) {
      // Only validate resources and paths for file-based searches
      const resourceValidation = await this.validator.validateResourceLimits(sanitizedParams.paths || ['.']);
      if (!resourceValidation.valid) {
        throw new ValidationError('Resource limits exceeded', {
          errors: resourceValidation.errors,
          params: sanitizedParams
        });
      }

      // Validate paths
      pathValidation = this.workspaceManager.validatePaths(sanitizedParams.paths || ['.']);
      if (!pathValidation.valid) {
        throw new ValidationError('Invalid paths', {
          errors: pathValidation.errors,
          params: sanitizedParams
        });
      }
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
      const filesScanned = this.extractFilesScanned(result.stderr, matches, pathValidation.resolvedPaths);

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
      const friendlyMessage = this.validator.translateAstGrepError(errorMessage, {
        pattern: sanitizedParams.pattern,
        language: sanitizedParams.language,
        paths: sanitizedParams.paths
      });

      throw new ExecutionError(
        `Search execution failed: ${friendlyMessage}`,
        { params: sanitizedParams, originalError: error }
      );
    }
  }

  private buildSearchArgs(params: SearchParams, resolvedPaths: string[]): string[] {
    const args: string[] = [];

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
      // ast-grep requires specific values for --no-ignore
      args.push('--no-ignore', 'hidden');
      args.push('--no-ignore', 'dot');
      args.push('--no-ignore', 'vcs');
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

  private extractFilesScanned(stderr: string, matches: SearchResult['matches'], resolvedPaths?: string[]): number {
    // Try to extract file count from stderr across multiple phrasings
    const patterns = [
      /(\d+)\s+files?\s+searched/i,
      /(\d+)\s+files?\s+scanned/i,
      /across\s+(\d+)\s+files?/i
    ];
    for (const re of patterns) {
      const m = stderr.match(re);
      if (m) return parseInt(m[1], 10);
    }

    // Enhanced fallback: count unique files from matches
    if (matches && matches.length > 0) {
      const unique = new Set(matches.map(m => m.file));
      return unique.size;
    }

    // NEW: Use file counting as fallback for consistency with ScanTool
    if (resolvedPaths && resolvedPaths.length > 0) {
      return this.countFilesInPaths(resolvedPaths);
    }

    return 0;
  }

  private countFilesInPaths(paths: string[]): number {
    let totalFiles = 0;

    for (const inputPath of paths) {
      try {
        const stats = fsSync.statSync(inputPath);

        if (stats.isFile()) {
          // Single file
          totalFiles += 1;
        } else if (stats.isDirectory()) {
          // Directory - count files that would be processed
          totalFiles += this.countFilesInDirectory(inputPath);
        }
      } catch (error) {
        // Skip inaccessible paths
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Warning: Cannot access path ${inputPath}:`, errorMessage);
      }
    }

    return totalFiles;
  }

  private countFilesInDirectory(dirPath: string): number {
    let count = 0;
    const visited = new Set(); // Prevent infinite loops from symlinks

    const scanDir = (currentPath: string, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 10 || visited.has(currentPath)) return;
      visited.add(currentPath);

      try {
        const items = fsSync.readdirSync(currentPath);

        for (const item of items) {
          // Skip common directories that shouldn't be scanned
          if (['node_modules', '.git', 'build', 'dist', '.next', 'coverage'].includes(item)) {
            continue;
          }

          const itemPath = path.join(currentPath, item);

          try {
            const stats = fsSync.statSync(itemPath);

            if (stats.isFile()) {
              // Count files that ast-grep would typically process
              const ext = path.extname(item).toLowerCase();
              if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.rs', '.go', '.cpp', '.c', '.h'].includes(ext)) {
                count++;
              }
            } else if (stats.isDirectory() && !item.startsWith('.')) {
              scanDir(itemPath, depth + 1);
            }
          } catch (error) {
            // Skip inaccessible files/directories
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    scanDir(dirPath);
    return count;
  }

  // Get tool schema for MCP
  static getSchema() {
    return {
      name: 'ast_search',
      description: 'Perform structural code search using AST patterns. Supports simple text search, metavariable capture, and complex structural patterns. BEST PRACTICE: Use "code" parameter for inline search (most reliable) or absolute paths for file-based search.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'AST pattern to search for using ast-grep syntax. Use metavariables: $VAR (single node), $$$ (multi-node), $NAME (capture names). Examples: "console.log($_)" (any console.log call), "function $NAME($ARGS)" (function definitions), "import $WHAT from $WHERE" (import statements), "class $NAME extends $BASE" (class inheritance), "var $NAME" (variable declarations).'
          },
          code: {
            type: 'string',
            description: 'RECOMMENDED: Search inline code instead of files. Most reliable method. Example: "console.log(\'test\'); const x = 5;" - will search this code directly and return matches with line/column positions.'
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files/directories to search. IMPORTANT: Use absolute paths for file-based search (e.g., "D:\\path\\to\\file.js"). Relative paths may not resolve correctly due to workspace detection issues. Default: current directory if no paths specified.'
          },
          language: {
            type: 'string',
            description: 'Programming language for pattern matching. Required when using "code" parameter. Common values: "javascript", "typescript", "python", "java", "rust", "go", "cpp". Auto-detected from file extensions if not specified.'
          },
          context: {
            type: 'number',
            minimum: 0,
            maximum: 10,
            default: 3,
            description: 'Lines of context around matches (0-10). Shows surrounding code for better understanding of match context.'
          },
          include: {
            type: 'array',
            items: { type: 'string' },
            description: 'Include glob patterns for file filtering. Example: ["**/*.js", "**/*.ts"] to only search JavaScript/TypeScript files.'
          },
          exclude: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exclude glob patterns. Default excludes: node_modules, .git, dist, build, coverage, *.min.js, *.bundle.js, .next, .vscode, .idea'
          },
          maxMatches: {
            type: 'number',
            minimum: 1,
            maximum: 10000,
            default: 100,
            description: 'Maximum number of matches to return across all files. Helps prevent overwhelming results from large codebases.'
          },
          perFileMatchLimit: {
            type: 'number',
            minimum: 1,
            maximum: 1000,
            description: 'Limit number of matches per file. Useful when searching large files to avoid too many results from a single file.'
          },
          follow: {
            type: 'boolean',
            default: false,
            description: 'Follow symlinks during file search'
          },
          threads: {
            type: 'number',
            minimum: 1,
            maximum: 64,
            description: 'Number of threads to use for parallel processing (default: auto)'
          },
          timeoutMs: {
            type: 'number',
            minimum: 1000,
            maximum: 120000,
            description: 'Timeout for ast-grep execution in milliseconds (default: 30000)'
          },
          relativePaths: {
            type: 'boolean',
            default: false,
            description: 'Return file paths relative to workspace root instead of absolute paths'
          },
          noIgnore: {
            type: 'boolean',
            default: false,
            description: 'Disable ignore rules and search all files including node_modules, .git, etc. Use with caution as it may search large amounts of files and hit resource limits.'
          },
          ignorePath: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional ignore file(s) to respect beyond default .gitignore patterns'
          },
          root: {
            type: 'string',
            description: 'Override project root used by ast-grep. Note: May not work as expected due to ast-grep command limitations.'
          },
          workdir: {
            type: 'string',
            description: 'Working directory for ast-grep. Note: May not work as expected due to ast-grep command limitations.'
          },
          stdinFilepath: {
            type: 'string',
            description: 'Virtual filepath for stdin content when using "code" parameter, used for language/ignore resolution'
          }
        },
        required: ['pattern']
      }
    };
  }
}