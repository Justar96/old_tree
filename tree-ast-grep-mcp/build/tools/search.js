import { ValidationError, ExecutionError } from '../types/errors.js';
/**
 * Direct search tool that calls ast-grep run with minimal overhead
 */
export class SearchTool {
    binaryManager;
    workspaceManager;
    constructor(binaryManager, workspaceManager) {
        this.binaryManager = binaryManager;
        this.workspaceManager = workspaceManager;
    }
    async execute(params) {
        // Basic validation - only what's absolutely necessary
        if (!params.pattern || typeof params.pattern !== 'string') {
            throw new ValidationError('Pattern is required');
        }
        // Normalize language aliases when provided
        const normalizeLang = (lang) => {
            const map = {
                javascript: 'js',
                typescript: 'ts',
                jsx: 'jsx',
                tsx: 'tsx',
            };
            const lower = (lang || '').toLowerCase();
            return map[lower] || lang;
        };
        // Guardrail: warn about bare $$$ in patterns
        const hasBareMulti = /\$\$\$(?![A-Za-z_][A-Za-z0-9_]*)/.test(params.pattern);
        if (hasBareMulti) {
            // Keep simple error to align with minimal philosophy
            throw new ValidationError('Use named multi-node metavariables like $$$BODY instead of bare $$$');
        }
        // Build ast-grep command directly
        const args = ['run', '--pattern', params.pattern.trim()];
        // Add language if provided
        if (params.language) {
            args.push('--lang', normalizeLang(params.language));
        }
        // Always use JSON stream for parsing
        args.push('--json=stream');
        // Add context if requested
        if (params.context && params.context > 0) {
            args.push('--context', params.context.toString());
        }
        // Handle inline code vs file paths
        let executeOptions = {
            cwd: this.workspaceManager.getWorkspaceRoot(),
            timeout: params.timeoutMs || 30000
        };
        if (params.code) {
            // Inline code mode
            args.push('--stdin');
            if (!params.language) {
                throw new ValidationError('Language required for inline code');
            }
            executeOptions.stdin = params.code;
        }
        else {
            // File mode - add paths (default to current directory)
            const inputPaths = params.paths && Array.isArray(params.paths) && params.paths.length > 0 ? params.paths : ['.'];
            const { valid, resolvedPaths, errors } = this.workspaceManager.validatePaths(inputPaths);
            if (!valid) {
                throw new ValidationError('Invalid paths', { errors });
            }
            // Try to infer language if not provided (based on extension of first path when it is a file)
            if (!params.language && resolvedPaths.length === 1) {
                const first = resolvedPaths[0].toLowerCase();
                const inferred = first.endsWith('.ts') ? 'ts' :
                    first.endsWith('.tsx') ? 'tsx' :
                        first.endsWith('.jsx') ? 'jsx' :
                            first.endsWith('.js') ? 'js' : undefined;
                if (inferred)
                    args.push('--lang', inferred);
            }
            args.push(...resolvedPaths);
        }
        try {
            const result = await this.binaryManager.executeAstGrep(args, executeOptions);
            return this.parseResults(result.stdout, params);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new ExecutionError(`Search failed: ${message}`);
        }
    }
    parseResults(stdout, params) {
        const matches = [];
        if (!stdout.trim()) {
            return { matches, summary: { totalMatches: 0, executionTime: 0 } };
        }
        // Parse JSONL output
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const match = JSON.parse(line);
                matches.push({
                    file: match.file || '',
                    line: (match.range?.start?.line || 0) + 1, // Convert to 1-based
                    column: match.range?.start?.column || 0,
                    text: match.text || '',
                    context: {
                        before: match.context?.before || [],
                        after: match.context?.after || []
                    }
                });
            }
            catch (e) {
                // Skip malformed lines
            }
        }
        return {
            matches: matches.slice(0, params.maxMatches || 100),
            summary: {
                totalMatches: matches.length,
                executionTime: 0 // We don't need precise timing
            }
        };
    }
    static getSchema() {
        return {
            name: 'ast_search',
            description: '🚀 SIMPLIFIED: Direct ast-grep search with minimal overhead. Fast, reliable AST pattern matching.',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'AST pattern: console.log($ARG), function $NAME($PARAMS) { $$$ }, etc.'
                    },
                    code: {
                        type: 'string',
                        description: 'Search inline code directly (recommended for testing)'
                    },
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'File paths to search (default: current directory)'
                    },
                    language: {
                        type: 'string',
                        description: 'Language: javascript, typescript, python, java, etc.'
                    },
                    context: {
                        type: 'number',
                        default: 3,
                        description: 'Lines of context around matches'
                    },
                    maxMatches: {
                        type: 'number',
                        default: 100,
                        description: 'Maximum matches to return'
                    },
                    timeoutMs: {
                        type: 'number',
                        default: 30000,
                        description: 'Timeout in milliseconds'
                    }
                },
                required: ['pattern']
            }
        };
    }
}
//# sourceMappingURL=search.js.map