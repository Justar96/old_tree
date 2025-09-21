import { ParameterValidator } from '../core/validator.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
export class SearchTool {
    binaryManager;
    validator;
    workspaceManager;
    constructor(binaryManager, workspaceManager) {
        this.binaryManager = binaryManager;
        this.workspaceManager = workspaceManager;
        this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
    }
    async execute(params) {
        const startTime = Date.now();
        // Validate parameters
        const validation = this.validator.validateSearchParams(params);
        if (!validation.valid) {
            throw new ValidationError('Invalid search parameters', {
                errors: validation.errors,
                params
            });
        }
        const sanitizedParams = validation.sanitized;
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
            // Execute ast-grep
            const result = await this.binaryManager.executeAstGrep(args, {
                cwd: this.workspaceManager.getWorkspaceRoot(),
                timeout: 30000 // 30 seconds
            });
            // Parse results
            const matches = this.parseSearchResults(result.stdout);
            const filesScanned = this.extractFilesScanned(result.stderr);
            return {
                matches: matches.slice(0, sanitizedParams.maxMatches),
                summary: {
                    totalMatches: matches.length,
                    filesScanned,
                    language: sanitizedParams.language,
                    executionTime: Date.now() - startTime
                }
            };
        }
        catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Try to translate ast-grep errors to user-friendly messages
            const friendlyMessage = this.validator.translateAstGrepError(errorMessage);
            throw new ExecutionError(`Search execution failed: ${friendlyMessage}`, { params: sanitizedParams, originalError: error });
        }
    }
    buildSearchArgs(params, resolvedPaths) {
        const args = ['run'];
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
        // Add JSON output for parsing
        args.push('--json=stream');
        // Add paths (must come after options)
        args.push(...resolvedPaths);
        return args;
    }
    parseSearchResults(stdout) {
        const matches = [];
        if (!stdout.trim()) {
            return matches;
        }
        try {
            // ast-grep outputs one JSON object per line
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const result = JSON.parse(line);
                // Handle different ast-grep output formats
                if (result.matches) {
                    // Multiple matches in one result
                    for (const match of result.matches) {
                        matches.push(this.parseSingleMatch(match));
                    }
                }
                else if (result.file) {
                    // Single match
                    matches.push(this.parseSingleMatch(result));
                }
            }
        }
        catch (error) {
            // If JSON parsing fails, try to extract basic information
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to parse ast-grep JSON output:', errorMessage);
        }
        return matches;
    }
    parseSingleMatch(match) {
        return {
            file: match.file || '',
            line: match.range?.start?.line ? match.range.start.line + 1 : 0, // ast-grep uses 0-based lines
            column: match.range?.start?.column || 0,
            text: match.text || match.lines || '',
            context: {
                before: match.context?.before || [],
                after: match.context?.after || []
            },
            matchedNode: match.text || match.lines || ''
        };
    }
    extractFilesScanned(stderr) {
        // Try to extract file count from stderr
        const fileCountMatch = stderr.match(/(\d+)\s+files?\s+searched/i);
        if (fileCountMatch) {
            return parseInt(fileCountMatch[1], 10);
        }
        // Fallback: count unique files from matches
        return 0;
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
                    }
                },
                required: ['pattern']
            }
        };
    }
}
//# sourceMappingURL=search.js.map