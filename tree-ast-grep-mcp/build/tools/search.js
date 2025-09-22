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
        // Build ast-grep command directly
        const args = ['run', '--pattern', params.pattern.trim()];
        // Add language if provided
        if (params.language) {
            args.push('--lang', params.language);
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
            const paths = params.paths || ['.'];
            args.push(...paths);
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