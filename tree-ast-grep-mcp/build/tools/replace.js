import { ValidationError, ExecutionError } from '../types/errors.js';
/**
 * Direct replace tool that calls ast-grep run --rewrite with minimal overhead
 */
export class ReplaceTool {
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
        if (!params.replacement) {
            throw new ValidationError('Replacement is required');
        }
        // Build ast-grep command directly
        const args = ['run', '--pattern', params.pattern.trim(), '--rewrite', params.replacement];
        // Add language if provided
        if (params.language) {
            args.push('--lang', params.language);
        }
        // Handle dry-run vs actual replacement
        if (!params.dryRun) {
            args.push('--update-all');
        }
        // Note: ast-grep run --rewrite outputs diff format by default (perfect for dry-run)
        // Handle inline code vs file paths
        let executeOptions = {
            cwd: this.workspaceManager.getWorkspaceRoot(),
            timeout: params.timeoutMs || 60000
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
            throw new ExecutionError(`Replace failed: ${message}`);
        }
    }
    parseResults(stdout, params) {
        const changes = [];
        if (!stdout.trim()) {
            return {
                changes,
                summary: {
                    totalChanges: 0,
                    filesModified: 0,
                    dryRun: params.dryRun !== false
                }
            };
        }
        // Parse diff output - very simple approach
        const lines = stdout.split('\n');
        let currentFile = '';
        let changeCount = 0;
        let diffContent = '';
        for (const line of lines) {
            if (line && !line.startsWith('@@') && !line.includes('│') && !line.startsWith(' ')) {
                // Looks like a file header
                if (currentFile && changeCount > 0) {
                    changes.push({
                        file: currentFile,
                        matches: changeCount,
                        preview: params.dryRun !== false ? diffContent : undefined,
                        applied: params.dryRun === false
                    });
                }
                currentFile = line.trim();
                changeCount = 0;
                diffContent = line + '\n';
            }
            else if (line.includes('│-') || line.includes('│+')) {
                if (line.includes('│-'))
                    changeCount++;
                diffContent += line + '\n';
            }
            else {
                diffContent += line + '\n';
            }
        }
        // Don't forget the last file
        if (currentFile && (changeCount > 0 || diffContent.trim())) {
            changes.push({
                file: currentFile,
                matches: Math.max(changeCount, 1),
                preview: params.dryRun !== false ? diffContent : undefined,
                applied: params.dryRun === false
            });
        }
        return {
            changes,
            summary: {
                totalChanges: changes.reduce((sum, c) => sum + c.matches, 0),
                filesModified: changes.length,
                dryRun: params.dryRun !== false
            }
        };
    }
    static getSchema() {
        return {
            name: 'ast_replace',
            description: '🚀 SIMPLIFIED: Direct ast-grep replace with minimal overhead. All metavariables work: $NAME, $$$, etc.',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'AST pattern: console.log($ARG), function $NAME($PARAMS) { $$$ }, etc.'
                    },
                    replacement: {
                        type: 'string',
                        description: 'Replacement template using same metavariables: logger.info($ARG), const $NAME = ($PARAMS) => { $$$ }, etc.'
                    },
                    code: {
                        type: 'string',
                        description: 'Apply replacement to inline code (recommended for testing)'
                    },
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'File paths to modify (default: current directory)'
                    },
                    language: {
                        type: 'string',
                        description: 'Language: javascript, typescript, python, java, etc.'
                    },
                    dryRun: {
                        type: 'boolean',
                        default: true,
                        description: 'Show preview without making changes'
                    },
                    timeoutMs: {
                        type: 'number',
                        default: 60000,
                        description: 'Timeout in milliseconds'
                    }
                },
                required: ['pattern', 'replacement']
            }
        };
    }
}
//# sourceMappingURL=replace.js.map