import * as fs from 'fs/promises';
import * as path from 'path';
import { ParameterValidator } from '../core/validator.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
export class ReplaceTool {
    binaryManager;
    validator;
    workspaceManager;
    constructor(binaryManager, workspaceManager) {
        this.binaryManager = binaryManager;
        this.workspaceManager = workspaceManager;
        this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
    }
    async execute(params) {
        // Validate parameters
        const validation = this.validator.validateReplaceParams(params);
        if (!validation.valid) {
            throw new ValidationError('Invalid replace parameters', {
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
        // For non-dry-run operations, create backups
        if (!sanitizedParams.dryRun) {
            await this.createBackups(pathValidation.resolvedPaths);
        }
        try {
            // Build ast-grep command arguments
            const args = this.buildReplaceArgs(sanitizedParams, pathValidation.resolvedPaths);
            // Execute ast-grep (stdin if code provided)
            let result;
            const timeout = sanitizedParams.dryRun ? (sanitizedParams.timeoutMs ?? 30000) : (sanitizedParams.timeoutMs ?? 60000);
            if (sanitizedParams.code) {
                const stdinArgs = [...args, '--stdin'];
                if (sanitizedParams.stdinFilepath) {
                    stdinArgs.push('--stdin-filepath', sanitizedParams.stdinFilepath);
                }
                result = await this.binaryManager.executeAstGrep(stdinArgs, {
                    cwd: this.workspaceManager.getWorkspaceRoot(),
                    timeout,
                    stdin: sanitizedParams.code
                });
            }
            else {
                result = await this.binaryManager.executeAstGrep(args, {
                    cwd: this.workspaceManager.getWorkspaceRoot(),
                    timeout
                });
            }
            // Parse results
            const changes = this.parseReplaceResults(result.stdout, sanitizedParams);
            return {
                changes,
                summary: {
                    totalChanges: changes.reduce((sum, change) => sum + change.matches, 0),
                    filesModified: changes.filter(change => change.applied).length,
                    dryRun: sanitizedParams.dryRun
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
            throw new ExecutionError(`Replace execution failed: ${friendlyMessage}`, { params: sanitizedParams, originalError: error });
        }
    }
    async createBackups(paths) {
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
        }
        catch (error) {
            // Log warning but don't fail the operation
            console.warn('Failed to create backups:', error);
        }
    }
    buildReplaceArgs(params, resolvedPaths) {
        const args = ['run'];
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
        // Respect ignore settings
        if (params.noIgnore) {
            args.push('--no-ignore');
        }
        if (params.ignorePath && params.ignorePath.length > 0) {
            for (const ig of params.ignorePath) {
                args.push('--ignore-path', ig);
            }
        }
        // Root/workdir controls
        if (params.root) {
            args.push('--root', params.root);
        }
        if (params.workdir) {
            args.push('--workdir', params.workdir);
        }
        // JSON output for parsing and diff preview in dry-run
        args.push(`--json=${params.jsonStyle || 'stream'}`);
        if (params.dryRun) {
            args.push('--diff');
        }
        // Follow symlinks
        if (params.follow) {
            args.push('--follow');
        }
        // Threads
        if (params.threads) {
            args.push('--threads', String(params.threads));
        }
        // Interactive vs update-all
        if (params.interactive && !params.dryRun) {
            args.push('--interactive');
        }
        else if (!params.dryRun) {
            args.push('--update-all');
        }
        // Add paths when not using stdin
        if (!params.code) {
            args.push(...resolvedPaths);
        }
        return args;
    }
    parseReplaceResults(stdout, params) {
        const changes = [];
        const workspaceRoot = this.workspaceManager.getWorkspaceRoot();
        if (!stdout.trim()) {
            return changes;
        }
        const pushChange = (raw) => {
            let filePath = raw.file || raw.path || '';
            if (params.relativePaths && filePath) {
                try {
                    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
                    const rel = path.relative(workspaceRoot, abs) || filePath;
                    filePath = rel.replace(/\\/g, '/');
                }
                catch { }
            }
            const captures = Array.isArray(raw.captures) ? raw.captures.map((c) => ({
                name: String(c.name ?? ''),
                text: c.text,
                startLine: c.range?.start?.line !== undefined ? Number(c.range.start.line) + 1 : undefined,
                startColumn: c.range?.start?.column !== undefined ? Number(c.range.start.column) : undefined,
                endLine: c.range?.end?.line !== undefined ? Number(c.range.end.line) + 1 : undefined,
                endColumn: c.range?.end?.column !== undefined ? Number(c.range.end.column) : undefined,
            })) : undefined;
            changes.push({
                file: filePath,
                matches: raw.matches || raw.count || 0,
                preview: params.dryRun ? raw.preview || raw.diff : undefined,
                applied: !params.dryRun && (raw.applied !== false),
                captures
            });
        };
        try {
            if ((params.jsonStyle || 'stream') === 'stream') {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    const result = JSON.parse(line);
                    if (Array.isArray(result.changes)) {
                        for (const change of result.changes)
                            pushChange(change);
                    }
                    else if (result.file) {
                        pushChange(result);
                    }
                }
            }
            else {
                const parsed = JSON.parse(stdout);
                if (Array.isArray(parsed)) {
                    for (const record of parsed) {
                        if (Array.isArray(record.changes)) {
                            for (const change of record.changes)
                                pushChange(change);
                        }
                        else if (record.file) {
                            pushChange(record);
                        }
                    }
                }
                else {
                    if (Array.isArray(parsed.changes)) {
                        for (const change of parsed.changes)
                            pushChange(change);
                    }
                    else if (parsed.file) {
                        pushChange(parsed);
                    }
                }
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to parse ast-grep JSON output:', errorMessage);
            // Fallback: try to extract basic information from stdout
            const fileMatches = stdout.match(/(\d+)\s+matches?\s+in\s+([^\n]+)/g);
            if (fileMatches) {
                for (const match of fileMatches) {
                    const [, count, file] = match.match(/(\d+)\s+matches?\s+in\s+(.+)/) || [];
                    if (count && file) {
                        let filePath = file.trim();
                        if (params.relativePaths && filePath) {
                            try {
                                const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
                                const rel = path.relative(workspaceRoot, abs) || filePath;
                                filePath = rel.replace(/\\/g, '/');
                            }
                            catch { }
                        }
                        changes.push({
                            file: filePath,
                            matches: parseInt(count, 10),
                            applied: !params.dryRun,
                            preview: params.dryRun ? `Would modify ${count} matches in ${file}` : undefined
                        });
                    }
                }
            }
        }
        return changes;
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
                    },
                    timeoutMs: {
                        type: 'number',
                        minimum: 1000,
                        maximum: 120000,
                        description: 'Timeout for ast-grep execution in milliseconds'
                    },
                    relativePaths: {
                        type: 'boolean',
                        default: false,
                        description: 'Return file paths relative to workspace root'
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
                        description: 'Apply rewrite on code provided via stdin instead of files (requires language)'
                    },
                    stdinFilepath: {
                        type: 'string',
                        description: 'Virtual filepath for stdin content, used for language/ignore resolution'
                    }
                },
                required: ['pattern', 'replacement']
            }
        };
    }
}
//# sourceMappingURL=replace.js.map