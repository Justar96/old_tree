import * as fs from 'fs/promises';
import * as path from 'path';
import { ParameterValidator } from '../core/validator.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
/**
 * Performs ast-grep replacements and writes changes within the workspace.
 */
export class ReplaceTool {
    binaryManager;
    validator;
    workspaceManager;
    /**
     * Initialize the tool with binary execution and workspace services.
     */
    constructor(binaryManager, workspaceManager) {
        this.binaryManager = binaryManager;
        this.workspaceManager = workspaceManager;
        this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
    }
    /**
     * Run ast-grep replace with validated parameters and return change metadata.
     */
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
        // Skip resource and path validation for inline code searches
        let pathValidation = { valid: true, resolvedPaths: [] };
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
        const args = [];
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
        // Root/workdir controls
        if (params.root) {
            args.push('--root', params.root);
        }
        if (params.workdir) {
            args.push('--workdir', params.workdir);
        }
        // Note: ast-grep rewrite doesn't support --json, outputs diff format
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
        // ast-grep rewrite outputs diff format, not JSON
        // Example output:
        // STDIN
        // @@ -0,1 +0,1 @@
        // 1  │-console.log("test");
        //   1│+logger.info("test");
        try {
            const diffBlocks = this.parseDiffOutput(stdout);
            for (const block of diffBlocks) {
                let filePath = block.file;
                // Handle relative paths
                if (params.relativePaths && filePath && filePath !== 'STDIN') {
                    try {
                        const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
                        const rel = path.relative(workspaceRoot, abs) || filePath;
                        filePath = rel.replace(/\\/g, '/');
                    }
                    catch { }
                }
                changes.push({
                    file: filePath,
                    matches: block.changeCount,
                    preview: params.dryRun ? block.diff : undefined,
                    applied: !params.dryRun,
                    captures: undefined // Diff format doesn't provide capture info
                });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to parse diff output:', errorMessage);
            console.error('Raw output:', stdout);
            // Fallback: if there's any output, assume there was at least one change
            if (stdout.trim()) {
                changes.push({
                    file: params.code ? 'STDIN' : 'unknown',
                    matches: 1,
                    preview: params.dryRun ? stdout.trim() : undefined,
                    applied: !params.dryRun
                });
            }
        }
        return changes;
    }
    parseDiffOutput(output) {
        const blocks = [];
        const lines = output.split('\n');
        let currentFile = '';
        let currentDiff = '';
        let changeCount = 0;
        let inDiffBlock = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Detect file header (file path on its own line, not starting with diff markers)
            if (!line.startsWith('@@') && !line.startsWith(' ') && !line.includes('│') &&
                line.trim() && !line.startsWith('Warning:') && !line.startsWith('Help:') &&
                !line.startsWith('error:') && !inDiffBlock) {
                // If we were processing a previous file, save it
                if (currentFile && (currentDiff || changeCount > 0)) {
                    blocks.push({
                        file: currentFile,
                        diff: currentDiff.trim(),
                        changeCount: changeCount
                    });
                }
                // Start new file
                currentFile = line.trim();
                currentDiff = line + '\n';
                changeCount = 0;
                inDiffBlock = false;
            }
            // Detect diff header (@@ lines)
            else if (line.startsWith('@@')) {
                inDiffBlock = true;
                currentDiff += line + '\n';
            }
            // Count actual changes (lines with │ that show additions/deletions)
            else if (line.includes('│') && inDiffBlock) {
                const hasChange = line.includes('│-') || line.includes('│+');
                if (hasChange) {
                    // Count each - or + as a change (replacements show as both - and +)
                    if (line.includes('│-'))
                        changeCount++;
                }
                currentDiff += line + '\n';
            }
            // Include other content if we're in a file context
            else if (currentFile) {
                currentDiff += line + '\n';
            }
        }
        // Don't forget the last block
        if (currentFile && (currentDiff || changeCount > 0)) {
            blocks.push({
                file: currentFile,
                diff: currentDiff.trim(),
                changeCount: Math.max(changeCount, 1) // At least 1 if we have a diff
            });
        }
        return blocks;
    }
    // Get tool schema for MCP
    /**
     * Describe the MCP schema for the replace tool.
     */
    static getSchema() {
        return {
            name: 'ast_replace',
            description: 'Perform structural find-and-replace operations using AST patterns. Supports simple text replacement, metavariable capture, and multi-node patterns. BEST PRACTICE: Use "code" parameter for inline replacement (most reliable) or absolute paths for file-based replacement.',
            inputSchema: {
                type: 'object',
                properties: {
                    pattern: {
                        type: 'string',
                        description: 'AST pattern to match using ast-grep syntax. Use metavariables: $VAR (single node), $$$ (multi-node), $NAME (capture names). Examples: "console.log($_)" (any console.log), "var $NAME" (var declarations), "console.log($$$)" (console.log with any args), "function $NAME($ARGS)" (function definitions).'
                    },
                    replacement: {
                        type: 'string',
                        description: 'Replacement template using same metavariables as pattern. Examples: "logger.info($_)" (replace console.log with logger.info), "let $NAME" (replace var with let), "logger.info($$$)" (replace console.log with logger.info keeping args), "const $NAME = ($ARGS) =>" (replace function with arrow function).'
                    },
                    code: {
                        type: 'string',
                        description: 'RECOMMENDED: Apply replacement on inline code instead of files. Most reliable method. Example: "console.log(\'test\'); const x = 5;" - will process this code directly and return diff preview.'
                    },
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Files/directories to process. IMPORTANT: Use absolute paths for file-based replacement (e.g., "D:\\path\\to\\file.js"). Relative paths may not resolve correctly due to workspace detection issues.'
                    },
                    language: {
                        type: 'string',
                        description: 'Programming language for pattern matching. Required when using "code" parameter. Common values: "javascript", "typescript", "python", "java", "rust", "go", "cpp". Auto-detected from file extensions if not specified.'
                    },
                    dryRun: {
                        type: 'boolean',
                        default: true,
                        description: 'Preview changes without applying them. Shows diff output of what would be changed. Set to false to actually apply changes to files.'
                    },
                    interactive: {
                        type: 'boolean',
                        default: false,
                        description: 'INTERACTIVE MODE: When true (and dryRun=false), ast-grep will prompt for confirmation before each replacement. Allows selective application of changes. Only works with actual replacements, not previews.'
                    },
                    include: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Include glob patterns for file filtering. Example: ["**/*.js", "**/*.ts"] to only process JavaScript/TypeScript files.'
                    },
                    exclude: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Exclude glob patterns. Default excludes: node_modules, .git, dist, build, coverage, *.min.js, *.bundle.js, .next, .vscode, .idea'
                    },
                    timeoutMs: {
                        type: 'number',
                        minimum: 1000,
                        maximum: 180000,
                        description: 'Timeout for ast-grep execution in milliseconds. Default: 30000 (30s) for dry-run, 60000 (60s) for actual replacements.'
                    },
                    relativePaths: {
                        type: 'boolean',
                        default: false,
                        description: 'Return file paths relative to workspace root instead of absolute paths'
                    },
                    follow: {
                        type: 'boolean',
                        default: false,
                        description: 'Follow symlinks during file processing'
                    },
                    threads: {
                        type: 'number',
                        minimum: 1,
                        maximum: 64,
                        description: 'Number of threads to use for parallel processing (default: auto)'
                    },
                    noIgnore: {
                        type: 'boolean',
                        default: false,
                        description: 'Disable ignore rules and process all files including node_modules, .git, etc. Use with caution as it may process large amounts of files.'
                    },
                    ignorePath: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional ignore file(s) to respect beyond default .gitignore patterns'
                    },
                    root: {
                        type: 'string',
                        description: 'Override project root used by ast-grep. Note: ast-grep run command does not support --root flag, this parameter may not work as expected.'
                    },
                    workdir: {
                        type: 'string',
                        description: 'Working directory for ast-grep. Note: ast-grep run command does not support --workdir flag, this parameter may not work as expected.'
                    },
                    stdinFilepath: {
                        type: 'string',
                        description: 'Virtual filepath for stdin content when using "code" parameter, used for language/ignore resolution'
                    }
                },
                required: ['pattern', 'replacement']
            }
        };
    }
}
//# sourceMappingURL=replace.js.map