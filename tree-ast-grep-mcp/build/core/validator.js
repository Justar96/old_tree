import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Validates tool parameters against workspace boundaries and security policies.
 */
export class ParameterValidator {
    workspaceRoot;
    blockedPaths;
    /**
     * Persist the workspace root and populate security guardrails.
     */
    constructor(workspaceRoot) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.blockedPaths = this.getBlockedPaths();
    }
    /**
     * Enumerate filesystem locations that tools must never modify.
     */
    getBlockedPaths() {
        const systemPaths = [
            '/etc', '/bin', '/usr', '/sys', '/proc', // Unix system dirs
            'C:\\Windows', 'C:\\Program Files', // Windows system dirs
            path.join(process.env.HOME || '', '.ssh'), // SSH keys
            path.join(process.env.HOME || '', '.aws'), // AWS credentials
            'node_modules/.bin', // Binary executables
        ];
        return systemPaths.map(p => path.resolve(p));
    }
    // Validate search parameters
    /**
     * Validate search tool parameters and sanitize defaults.
     */
    validateSearchParams(params) {
        const result = { valid: true, errors: [], warnings: [] };
        // Validate pattern
        if (!params.pattern || typeof params.pattern !== 'string' || params.pattern.trim().length === 0) {
            result.valid = false;
            result.errors.push('Pattern cannot be empty');
            return result;
        }
        // Check for dangerous patterns
        const dangerousPatterns = ['rm -rf', 'del /f', 'format c:', '> /dev/null'];
        if (dangerousPatterns.some(dangerous => params.pattern.includes(dangerous))) {
            result.valid = false;
            result.errors.push('Pattern contains potentially dangerous commands');
            return result;
        }
        // Validate AST pattern syntax
        const patternValidation = this.validateAstPattern(params.pattern, params.language);
        if (!patternValidation.valid) {
            result.valid = false;
            result.errors.push(...patternValidation.errors);
            result.warnings.push(...patternValidation.warnings);
        }
        // Validate paths if provided
        if (params.paths) {
            const pathValidation = this.validatePaths(params.paths);
            if (!pathValidation.valid) {
                result.valid = false;
                result.errors.push(...pathValidation.errors);
            }
        }
        // Validate context
        if (params.context !== undefined) {
            if (typeof params.context !== 'number' || params.context < 0 || params.context > 10) {
                result.valid = false;
                result.errors.push('Context must be a number between 0 and 10');
            }
        }
        // Validate maxMatches
        if (params.maxMatches !== undefined) {
            if (typeof params.maxMatches !== 'number' || params.maxMatches < 1 || params.maxMatches > 10000) {
                result.valid = false;
                result.errors.push('maxMatches must be a number between 1 and 10000');
            }
        }
        // Validate timeoutMs
        if (params.timeoutMs !== undefined) {
            if (typeof params.timeoutMs !== 'number' || params.timeoutMs < 1000 || params.timeoutMs > 120000) {
                result.valid = false;
                result.errors.push('timeoutMs must be between 1000 and 120000 milliseconds');
            }
        }
        // Validate perFileMatchLimit
        if (params.perFileMatchLimit !== undefined) {
            if (typeof params.perFileMatchLimit !== 'number' || params.perFileMatchLimit < 1 || params.perFileMatchLimit > 1000) {
                result.valid = false;
                result.errors.push('perFileMatchLimit must be a number between 1 and 1000');
            }
        }
        // Validate ignorePath/root/workdir
        if (params.ignorePath !== undefined && !Array.isArray(params.ignorePath)) {
            result.valid = false;
            result.errors.push('ignorePath must be an array of strings');
        }
        if (params.root !== undefined && typeof params.root !== 'string') {
            result.valid = false;
            result.errors.push('root must be a string path');
        }
        if (params.workdir !== undefined && typeof params.workdir !== 'string') {
            result.valid = false;
            result.errors.push('workdir must be a string path');
        }
        // Validate code/stdinFilepath
        if (params.code !== undefined && typeof params.code !== 'string') {
            result.valid = false;
            result.errors.push('code must be a string');
        }
        if (params.stdinFilepath !== undefined && typeof params.stdinFilepath !== 'string') {
            result.valid = false;
            result.errors.push('stdinFilepath must be a string path');
        }
        if (params.code && params.paths && params.paths.length > 0) {
            result.warnings.push('Ignoring paths since code is provided for stdin search');
        }
        // Validate jsonStyle/follow/threads
        if (params.jsonStyle !== undefined && !['stream', 'pretty', 'compact'].includes(params.jsonStyle)) {
            result.valid = false;
            result.errors.push('jsonStyle must be one of: stream, pretty, compact');
        }
        if (params.follow !== undefined && typeof params.follow !== 'boolean') {
            result.valid = false;
            result.errors.push('follow must be a boolean');
        }
        if (params.threads !== undefined && (typeof params.threads !== 'number' || params.threads < 1 || params.threads > 64)) {
            result.valid = false;
            result.errors.push('threads must be a number between 1 and 64');
        }
        result.sanitized = {
            pattern: params.pattern.trim(),
            paths: params.paths || ['.'],
            language: params.language || this.detectLanguageFromPattern(params.pattern.trim()),
            context: params.context ?? 3,
            include: params.include,
            exclude: params.exclude || this.getDefaultExcludes(),
            maxMatches: params.maxMatches ?? 100,
            timeoutMs: params.timeoutMs,
            relativePaths: params.relativePaths ?? false,
            perFileMatchLimit: params.perFileMatchLimit,
            noIgnore: params.noIgnore ?? false,
            ignorePath: params.ignorePath,
            root: params.root,
            workdir: params.workdir,
            code: params.code,
            stdinFilepath: params.stdinFilepath,
            jsonStyle: params.jsonStyle || 'stream',
            follow: params.follow ?? false,
            threads: params.threads,
        };
        return result;
    }
    // Validate replace parameters
    /**
     * Validate replace tool parameters and enforce workspace boundaries.
     */
    validateReplaceParams(params) {
        const result = { valid: true, errors: [], warnings: [] };
        // Validate pattern
        if (!params.pattern || typeof params.pattern !== 'string' || params.pattern.trim().length === 0) {
            result.valid = false;
            result.errors.push('Pattern cannot be empty');
            return result;
        }
        // Validate replacement
        if (params.replacement === undefined || params.replacement === null) {
            result.valid = false;
            result.errors.push('Replacement cannot be null or undefined');
            return result;
        }
        // Validate AST pattern syntax
        const patternValidation = this.validateAstPattern(params.pattern, params.language);
        if (!patternValidation.valid) {
            result.valid = false;
            result.errors.push(...patternValidation.errors);
            result.warnings.push(...patternValidation.warnings);
        }
        // Validate pattern-replacement consistency
        const consistencyValidation = this.validatePatternReplacementConsistency(params.pattern, params.replacement);
        if (!consistencyValidation.valid) {
            result.valid = false;
            result.errors.push(...consistencyValidation.errors);
            result.warnings.push(...consistencyValidation.warnings);
        }
        // Validate paths if provided
        if (params.paths) {
            const pathValidation = this.validatePaths(params.paths);
            if (!pathValidation.valid) {
                result.valid = false;
                result.errors.push(...pathValidation.errors);
            }
        }
        // New validations
        if (params.timeoutMs !== undefined && (typeof params.timeoutMs !== 'number' || params.timeoutMs < 1000 || params.timeoutMs > 180000)) {
            result.valid = false;
            result.errors.push('timeoutMs must be between 1000 and 180000 milliseconds');
        }
        if (params.relativePaths !== undefined && typeof params.relativePaths !== 'boolean') {
            result.valid = false;
            result.errors.push('relativePaths must be a boolean');
        }
        if (params.jsonStyle !== undefined && !['stream', 'pretty', 'compact'].includes(params.jsonStyle)) {
            result.valid = false;
            result.errors.push('jsonStyle must be one of: stream, pretty, compact');
        }
        if (params.follow !== undefined && typeof params.follow !== 'boolean') {
            result.valid = false;
            result.errors.push('follow must be a boolean');
        }
        if (params.threads !== undefined && (typeof params.threads !== 'number' || params.threads < 1 || params.threads > 64)) {
            result.valid = false;
            result.errors.push('threads must be a number between 1 and 64');
        }
        if (params.noIgnore !== undefined && typeof params.noIgnore !== 'boolean') {
            result.valid = false;
            result.errors.push('noIgnore must be a boolean');
        }
        if (params.ignorePath !== undefined && !Array.isArray(params.ignorePath)) {
            result.valid = false;
            result.errors.push('ignorePath must be an array of strings');
        }
        if (params.root !== undefined && typeof params.root !== 'string') {
            result.valid = false;
            result.errors.push('root must be a string path');
        }
        if (params.workdir !== undefined && typeof params.workdir !== 'string') {
            result.valid = false;
            result.errors.push('workdir must be a string path');
        }
        if (params.code !== undefined && typeof params.code !== 'string') {
            result.valid = false;
            result.errors.push('code must be a string');
        }
        if (params.stdinFilepath !== undefined && typeof params.stdinFilepath !== 'string') {
            result.valid = false;
            result.errors.push('stdinFilepath must be a string path');
        }
        result.sanitized = {
            pattern: params.pattern.trim(),
            replacement: String(params.replacement),
            paths: params.paths || ['.'],
            language: params.language || this.detectLanguageFromPattern(params.pattern.trim()),
            dryRun: params.dryRun ?? true,
            interactive: params.interactive ?? false,
            include: params.include,
            exclude: params.exclude || this.getDefaultExcludes(),
            timeoutMs: params.timeoutMs,
            relativePaths: params.relativePaths ?? false,
            jsonStyle: params.jsonStyle || 'stream',
            follow: params.follow ?? false,
            threads: params.threads,
            noIgnore: params.noIgnore ?? false,
            ignorePath: params.ignorePath,
            root: params.root,
            workdir: params.workdir,
            code: params.code,
            stdinFilepath: params.stdinFilepath,
        };
        return result;
    }
    // Validate scan parameters
    /**
     * Validate scan tool parameters and normalize rule execution options.
     */
    validateScanParams(params) {
        const result = { valid: true, errors: [], warnings: [] };
        // Validate format
        if (params.format && !['json', 'text', 'github'].includes(params.format)) {
            result.valid = false;
            result.errors.push('Format must be one of: json, text, github');
        }
        // Validate severity
        if (params.severity && !['error', 'warning', 'info', 'all'].includes(params.severity)) {
            result.valid = false;
            result.errors.push('Severity must be one of: error, warning, info, all');
        }
        // Validate paths if provided
        if (params.paths) {
            const pathValidation = this.validatePaths(params.paths);
            if (!pathValidation.valid) {
                result.valid = false;
                result.errors.push(...pathValidation.errors);
            }
        }
        // Advanced validations
        if (params.timeoutMs !== undefined && (typeof params.timeoutMs !== 'number' || params.timeoutMs < 1000 || params.timeoutMs > 180000)) {
            result.valid = false;
            result.errors.push('timeoutMs must be between 1000 and 180000 milliseconds');
        }
        if (params.relativePaths !== undefined && typeof params.relativePaths !== 'boolean') {
            result.valid = false;
            result.errors.push('relativePaths must be a boolean');
        }
        if (params.jsonStyle !== undefined && !['stream', 'pretty', 'compact'].includes(params.jsonStyle)) {
            result.valid = false;
            result.errors.push('jsonStyle must be one of: stream, pretty, compact');
        }
        if (params.follow !== undefined && typeof params.follow !== 'boolean') {
            result.valid = false;
            result.errors.push('follow must be a boolean');
        }
        if (params.threads !== undefined && (typeof params.threads !== 'number' || params.threads < 1 || params.threads > 64)) {
            result.valid = false;
            result.errors.push('threads must be a number between 1 and 64');
        }
        if (params.noIgnore !== undefined && typeof params.noIgnore !== 'boolean') {
            result.valid = false;
            result.errors.push('noIgnore must be a boolean');
        }
        if (params.ignorePath !== undefined && !Array.isArray(params.ignorePath)) {
            result.valid = false;
            result.errors.push('ignorePath must be an array of strings');
        }
        if (params.root !== undefined && typeof params.root !== 'string') {
            result.valid = false;
            result.errors.push('root must be a string path');
        }
        if (params.workdir !== undefined && typeof params.workdir !== 'string') {
            result.valid = false;
            result.errors.push('workdir must be a string path');
        }
        result.sanitized = {
            rules: params.rules,
            paths: params.paths || ['.'],
            format: params.format || 'json',
            severity: params.severity || 'all',
            ruleIds: params.ruleIds,
            include: params.include,
            exclude: params.exclude || this.getDefaultExcludes(),
            timeoutMs: params.timeoutMs,
            relativePaths: params.relativePaths ?? false,
            jsonStyle: params.jsonStyle || 'stream',
            follow: params.follow ?? false,
            threads: params.threads,
            noIgnore: params.noIgnore ?? false,
            ignorePath: params.ignorePath,
            root: params.root,
            workdir: params.workdir,
        };
        return result;
    }
    // Validate rewrite parameters
    /**
     * Validate rewrite tool parameters including pattern and rewrite rules.
     */
    validateRewriteParams(params) {
        const result = { valid: true, errors: [], warnings: [] };
        // Validate rules
        if (!params.rules || typeof params.rules !== 'string' || params.rules.trim().length === 0) {
            result.valid = false;
            result.errors.push('Rules cannot be empty');
            return result;
        }
        // Validate paths if provided
        if (params.paths) {
            const pathValidation = this.validatePaths(params.paths);
            if (!pathValidation.valid) {
                result.valid = false;
                result.errors.push(...pathValidation.errors);
            }
        }
        result.sanitized = {
            rules: params.rules.trim(),
            paths: params.paths || ['.'],
            language: params.language,
            dryRun: params.dryRun ?? true,
        };
        return result;
    }
    // Validate paths for security
    /**
     * Ensure provided paths stay within the workspace and are accessible.
     */
    validatePaths(paths) {
        const result = { valid: true, errors: [], warnings: [] };
        const sanitizedPaths = [];
        for (const inputPath of paths) {
            try {
                // Resolve and normalize path
                const resolvedPath = path.resolve(this.workspaceRoot, inputPath);
                const normalizedRoot = path.resolve(this.workspaceRoot);
                const relativeFromRoot = path.relative(normalizedRoot, resolvedPath);
                // Security check: ensure path is within workspace using robust relative check
                if (relativeFromRoot === '' ||
                    relativeFromRoot === '.') {
                    // resolvedPath is the root itself; allow
                }
                else if (relativeFromRoot.startsWith('..' + path.sep) ||
                    relativeFromRoot === '..') {
                    result.valid = false;
                    result.errors.push(`Path "${inputPath}" is outside workspace root`);
                    continue;
                }
                // Check for blocked system directories
                if (this.blockedPaths.some(blocked => resolvedPath.startsWith(blocked))) {
                    result.valid = false;
                    result.errors.push(`Access to system directory "${inputPath}" is blocked`);
                    continue;
                }
                sanitizedPaths.push(resolvedPath);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                result.valid = false;
                result.errors.push(`Invalid path "${inputPath}": ${errorMessage}`);
            }
        }
        result.sanitized = sanitizedPaths;
        return result;
    }
    // Validate resource limits
    async validateResourceLimits(paths) {
        const result = { valid: true, errors: [], warnings: [] };
        const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB
        const maxFiles = parseInt(process.env.MAX_FILES || '100000');
        let totalFiles = 0;
        for (const dirPath of paths) {
            try {
                const absolutePath = path.resolve(this.workspaceRoot, dirPath);
                const stats = await fs.stat(absolutePath);
                if (stats.isFile()) {
                    totalFiles++;
                    if (stats.size > maxFileSize) {
                        result.warnings.push(`File "${absolutePath}" (${stats.size} bytes) exceeds size limit`);
                    }
                }
                else if (stats.isDirectory()) {
                    // Count files in directory
                    const files = await this.countFilesRecursive(absolutePath);
                    totalFiles += files;
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                result.warnings.push(`Cannot access "${path.resolve(this.workspaceRoot, dirPath)}": ${errorMessage}`);
            }
        }
        if (totalFiles > maxFiles) {
            result.valid = false;
            result.errors.push(`Total files (${totalFiles}) exceeds limit (${maxFiles})`);
        }
        return result;
    }
    /**
     * Estimate file counts by walking directories with safeguards.
     */
    async countFilesRecursive(dir) {
        let count = 0;
        try {
            const items = await fs.readdir(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                try {
                    const stats = await fs.stat(itemPath);
                    if (stats.isFile()) {
                        count++;
                    }
                    else if (stats.isDirectory() && !item.startsWith('.')) {
                        count += await this.countFilesRecursive(itemPath);
                    }
                }
                catch {
                    // Skip inaccessible files
                }
            }
        }
        catch {
            // Skip inaccessible directories
        }
        return count;
    }
    // Extract metavariables from AST pattern
    /**
     * Identify single and multi node metavariables within a pattern.
     */
    extractMetavariables(pattern) {
        const single = [];
        const multi = [];
        // Match single metavariables: $VAR, $_, $VAR1
        const singleMatches = pattern.match(/\$[A-Z_][A-Z0-9_]*/g) || [];
        single.push(...singleMatches.map(m => m.slice(1))); // Remove $
        // Match multi metavariables: $$$VAR, $$$
        const multiMatches = pattern.match(/\$\$\$[A-Z_]*[A-Z0-9_]*/g) || [];
        multi.push(...multiMatches.map(m => m.slice(3))); // Remove $$$
        return { single, multi };
    }
    // Validate AST pattern syntax
    /**
     * Validate that the ast-grep pattern is syntactically correct for the language.
     */
    validateAstPattern(pattern, language) {
        const result = { valid: true, errors: [], warnings: [] };
        // Check for basic syntax issues
        const trimmedPattern = pattern.trim();
        // Check for unmatched brackets/parentheses
        const brackets = { '(': ')', '[': ']', '{': '}' };
        const stack = [];
        for (const char of trimmedPattern) {
            if (char in brackets) {
                stack.push(brackets[char]);
            }
            else if (Object.values(brackets).includes(char)) {
                if (stack.pop() !== char) {
                    result.errors.push('Pattern has unmatched brackets, parentheses, or braces');
                    result.valid = false;
                    break;
                }
            }
        }
        // Check for invalid metavariable syntax
        const invalidMetavars = trimmedPattern.match(/\$[a-z][a-zA-Z0-9_]*/g);
        if (invalidMetavars) {
            result.errors.push(`Invalid metavariable syntax: ${invalidMetavars.join(', ')}. Metavariables must start with uppercase letter or underscore (e.g., $VAR, $_)`);
            result.valid = false;
        }
        // Check for incomplete metavariables ($$X where X is not $ or whitespace/boundary)
        // This should catch things like $$a but not $$$
        const incompleteMetavars = trimmedPattern.match(/\$\$(?!\$)[a-zA-Z_]/g);
        if (incompleteMetavars) {
            result.errors.push('Incomplete multi-metavariable syntax. Use $$$ for multi-node matching');
            result.valid = false;
        }
        // Language-specific validation
        if (language) {
            const langValidation = this.validateLanguageSpecificPattern(trimmedPattern, language);
            if (!langValidation.valid) {
                result.errors.push(...langValidation.errors);
                result.warnings.push(...langValidation.warnings);
                result.valid = false;
            }
        }
        else if (this.requiresLanguageHint(trimmedPattern)) {
            result.warnings.push('Pattern may benefit from specifying a language parameter for better matching');
        }
        return result;
    }
    // Validate pattern-replacement consistency
    /**
     * Ensure replacement templates match the captured metavariables.
     */
    validatePatternReplacementConsistency(pattern, replacement) {
        const result = { valid: true, errors: [], warnings: [] };
        const patternVars = this.extractMetavariables(pattern);
        const replacementVars = this.extractMetavariables(replacement);
        // Check that all replacement metavariables exist in pattern
        const allPatternVars = [...patternVars.single, ...patternVars.multi];
        const allReplacementVars = [...replacementVars.single, ...replacementVars.multi];
        const undefinedVars = allReplacementVars.filter(rv => !allPatternVars.includes(rv));
        if (undefinedVars.length > 0) {
            result.valid = false;
            result.errors.push(`Replacement uses undefined metavariables: ${undefinedVars.map(v => '$' + v).join(', ')}. Available from pattern: ${allPatternVars.map(v => '$' + v).join(', ')}`);
        }
        // Warn about unused pattern variables
        const unusedVars = allPatternVars.filter(pv => !allReplacementVars.includes(pv) && pv !== '_');
        if (unusedVars.length > 0) {
            result.warnings.push(`Pattern defines unused metavariables: ${unusedVars.map(v => '$' + v).join(', ')}`);
        }
        return result;
    }
    // Check if pattern requires language hint
    /**
     * Determine if a pattern needs an explicit language selection.
     */
    requiresLanguageHint(pattern) {
        // Patterns that typically need language context
        const languageSpecificKeywords = [
            'function', 'class', 'interface', 'import', 'export', // JS/TS
            'def', 'class', 'import', 'from', // Python
            'public', 'private', 'protected', 'static', // Java/C#
            'fn', 'impl', 'trait', 'use', // Rust
            'func', 'type', 'var', 'const', // Go
        ];
        return languageSpecificKeywords.some(keyword => pattern.includes(keyword));
    }
    // Language-specific pattern validation
    /**
     * Run language specific validation rules for advanced patterns.
     */
    validateLanguageSpecificPattern(pattern, language) {
        const result = { valid: true, errors: [], warnings: [] };
        switch (language.toLowerCase()) {
            case 'javascript':
            case 'typescript':
                // Check for common JS/TS patterns
                if (pattern.includes('function') && !pattern.includes('(')) {
                    result.warnings.push('JavaScript function patterns usually need parentheses: function $NAME($ARGS)');
                }
                if (pattern.includes('import') && !pattern.includes('from')) {
                    result.warnings.push('JavaScript import patterns often need "from": import $WHAT from $WHERE');
                }
                break;
            case 'java':
                // Check for common Java patterns
                if (pattern.includes('public') && !pattern.includes('(') && !pattern.includes('{')) {
                    result.warnings.push('Java method patterns usually need parentheses and braces: public $TYPE $NAME($ARGS) { $$$ }');
                }
                break;
            case 'python':
                // Check for common Python patterns
                if (pattern.includes('def') && !pattern.includes(':')) {
                    result.warnings.push('Python function patterns need colon: def $NAME($ARGS): $$$');
                }
                break;
            default:
                // Unknown language - provide general guidance
                if (this.requiresLanguageHint(pattern)) {
                    result.warnings.push(`Language "${language}" not specifically supported. Pattern may need adjustment for proper AST parsing.`);
                }
        }
        return result;
    }
    // Get default exclude patterns
    /**
     * Provide default exclude globs to avoid scanning generated content.
     */
    getDefaultExcludes() {
        return [
            'node_modules/**',
            '.git/**',
            'dist/**',
            'build/**',
            'coverage/**',
            '*.min.js',
            '*.bundle.js',
            '.next/**',
            '.vscode/**',
            '.idea/**'
        ];
    }
    // Detect language from pattern content
    /**
     * Infer a probable language from a pattern when none is specified.
     */
    detectLanguageFromPattern(pattern) {
        // JavaScript/TypeScript patterns
        if (pattern.match(/\b(function|const|let|var|import|export|class|interface|type)\b/)) {
            if (pattern.includes('interface') || pattern.includes('type ') || pattern.includes(': ')) {
                return 'typescript';
            }
            return 'javascript';
        }
        // Python patterns
        if (pattern.match(/\b(def|class|import|from|if __name__|print)\b/) || pattern.includes(':')) {
            return 'python';
        }
        // Java patterns
        if (pattern.match(/\b(public|private|protected|static|class|interface|extends|implements)\b/)) {
            return 'java';
        }
        // Rust patterns
        if (pattern.match(/\b(fn|impl|trait|struct|enum|use|mod)\b/)) {
            return 'rust';
        }
        // Go patterns
        if (pattern.match(/\b(func|type|var|const|package|import)\b/)) {
            return 'go';
        }
        // C/C++ patterns
        if (pattern.match(/\b(#include|struct|typedef|void|int|char|float|double)\b/)) {
            return 'cpp';
        }
        return undefined;
    }
    // Enhanced error translation with context awareness
    translateAstGrepError(errorMessage, context) {
        // File not found errors
        if (errorMessage.includes('cannot find the file') || errorMessage.includes('No such file') || errorMessage.includes('system cannot find the file')) {
            return `File not found. Check that the path exists and is accessible from workspace root: ${this.workspaceRoot}. Tip: Use absolute paths or ensure files exist in the workspace.`;
        }
        // Permission denied errors
        if (errorMessage.includes('permission denied') || errorMessage.includes('access denied')) {
            return `Permission denied accessing file or directory. Ensure the MCP server has read access to the specified paths.`;
        }
        // Pattern syntax errors
        if (errorMessage.includes('pattern') && (errorMessage.includes('error') || errorMessage.includes('invalid'))) {
            const patternContext = context?.pattern ? ` Pattern: "${context.pattern}"` : '';
            return `Invalid AST pattern syntax.${patternContext} Check metavariable usage: $VAR (single nodes), $$$ (multi-node). Ensure proper brackets and quotes.`;
        }
        // Language detection errors
        if (errorMessage.includes('language') && (errorMessage.includes('not supported') || errorMessage.includes('unknown'))) {
            const availableLanguages = ['javascript', 'typescript', 'python', 'java', 'rust', 'go', 'cpp', 'c', 'html', 'css'];
            return `Language detection failed. Specify language explicitly or check file extensions. Available languages: ${availableLanguages.join(', ')}`;
        }
        // Parsing errors
        if (errorMessage.includes('parse error') || errorMessage.includes('syntax error')) {
            const languageContext = context?.language ? ` for ${context.language}` : '';
            return `Code parsing failed${languageContext}. Check if files contain valid syntax for the specified language. Some files may be corrupted or in binary format.`;
        }
        // Timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            const pathContext = context?.paths ? ` Paths: ${Array.isArray(context.paths) ? context.paths.join(', ') : context.paths}` : '';
            return `Operation timed out. Try: 1) Narrowing search paths, 2) Simplifying patterns, 3) Excluding large directories like node_modules.${pathContext}`;
        }
        // Empty results (not an error but needs better messaging)
        if (errorMessage.includes('no matches found') || errorMessage.includes('0 matches')) {
            const suggestions = [
                'Check if files contain the expected patterns',
                'Verify language parameter matches file types',
                'Try simpler patterns first',
                'Use metavariables like $VAR for flexible matching'
            ];
            return `No matches found. Suggestions: ${suggestions.join(', ')}`;
        }
        // Binary/executable errors
        if (errorMessage.includes('not found') && errorMessage.includes('ast-grep')) {
            return `ast-grep binary not found. Ensure binary is installed or use --auto-install flag. Check AST_GREP_BINARY_PATH environment variable.`;
        }
        // Resource exhaustion
        if (errorMessage.includes('too many') || errorMessage.includes('limit exceeded')) {
            return `Resource limits exceeded. Try: 1) Reducing search scope, 2) Using include/exclude patterns, 3) Increasing timeout limits.`;
        }
        // Network/download errors (for binary management)
        if (errorMessage.includes('download') || errorMessage.includes('network')) {
            return `Network error downloading ast-grep binary. Check internet connection or use --use-system flag to use system-installed ast-grep.`;
        }
        // Path traversal warnings
        if (errorMessage.includes('outside workspace') || errorMessage.includes('blocked path')) {
            return `Path outside workspace boundaries. For security, only paths within the workspace root are allowed: ${this.workspaceRoot}`;
        }
        // Return enhanced error with workspace context
        return `${errorMessage} (Workspace: ${this.workspaceRoot})`;
    }
    // Validate rule builder parameters
    /**
     * Validate rule builder inputs before generating or executing ast-grep rules.
     */
    validateRuleBuilderParams(params) {
        const result = { valid: true, errors: [], warnings: [] };
        if (!params || typeof params !== 'object') {
            result.valid = false;
            result.errors.push('Parameters must be an object');
            return result;
        }
        if (!params.id || typeof params.id !== 'string' || params.id.trim().length === 0) {
            result.valid = false;
            result.errors.push('id is required');
        }
        if (!params.language || typeof params.language !== 'string' || params.language.trim().length === 0) {
            result.valid = false;
            result.errors.push('language is required');
        }
        if (!params.pattern || typeof params.pattern !== 'string' || params.pattern.trim().length === 0) {
            result.valid = false;
            result.errors.push('pattern is required');
        }
        // Basic AST pattern validation
        const patternValidation = this.validateAstPattern(params.pattern, params.language);
        if (!patternValidation.valid) {
            result.valid = false;
            result.errors.push(...patternValidation.errors);
            result.warnings.push(...patternValidation.warnings);
        }
        result.sanitized = {
            id: String(params.id).trim(),
            language: String(params.language).trim(),
            pattern: String(params.pattern).trim(),
            message: params.message ? String(params.message) : undefined,
            severity: params.severity || 'warning',
            kind: params.kind ? String(params.kind) : undefined,
            insidePattern: params.insidePattern ? String(params.insidePattern) : undefined,
            hasPattern: params.hasPattern ? String(params.hasPattern) : undefined,
            notPattern: params.notPattern ? String(params.notPattern) : undefined,
            where: Array.isArray(params.where) ? params.where.map((w) => ({
                metavariable: String(w.metavariable),
                regex: w.regex ? String(w.regex) : undefined,
                notRegex: w.notRegex ? String(w.notRegex) : undefined,
                equals: w.equals ? String(w.equals) : undefined,
                includes: w.includes ? String(w.includes) : undefined,
            })) : undefined,
            fix: params.fix ? String(params.fix) : undefined,
        };
        return result;
    }
}
//# sourceMappingURL=validator.js.map