import * as fs from 'fs/promises';
import * as path from 'path';
import { ParameterValidator } from '../core/validator.js';
export class RunRuleTool {
    validator;
    scanTool;
    workspaceManager;
    constructor(workspaceManager, scanTool) {
        this.workspaceManager = workspaceManager;
        this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
        this.scanTool = scanTool;
    }
    static getSchema() {
        return {
            name: 'ast_run_rule',
            description: 'Generate an ast-grep YAML rule and immediately run ast_scan with it. Perfect for creating custom linting rules, security checks, and code analysis patterns. BEST PRACTICE: Use absolute paths for file-based scanning.',
            inputSchema: {
                type: 'object',
                properties: {
                    // Rule fields
                    id: {
                        type: 'string',
                        description: 'Rule ID (unique and descriptive). Used to identify the rule in results. Example: "no-console-log", "prefer-const", "security-hardcoded-secret".'
                    },
                    language: {
                        type: 'string',
                        description: 'Programming language for the rule. Common values: "javascript", "typescript", "python", "java", "rust", "go", "cpp". Determines AST parsing and pattern matching behavior.'
                    },
                    pattern: {
                        type: 'string',
                        description: 'Primary AST pattern with metavariables describing what to match. Use: $VAR (single node), $$$ (multi-node), $NAME (capture names). Examples: "console.log($_)" (any console.log), "var $NAME" (var declarations), "function $NAME($ARGS)" (function definitions).'
                    },
                    message: {
                        type: 'string',
                        description: 'Human-readable message explaining the finding. Shown to users when rule matches. Example: "Use logger.info instead of console.log", "Prefer const over var for immutable variables".'
                    },
                    severity: {
                        type: 'string',
                        enum: ['error', 'warning', 'info'],
                        default: 'warning',
                        description: 'Severity level for rule. "error" for critical issues, "warning" for important issues, "info" for suggestions.'
                    },
                    kind: {
                        type: 'string',
                        description: 'Optional node kind to constrain matches (language-specific). Examples: "function_declaration", "variable_declaration", "call_expression". Helps narrow down matches to specific AST node types.'
                    },
                    insidePattern: {
                        type: 'string',
                        description: 'Optional: pattern that the match must be inside of. Example: "class $CLASS { $$$ }" to only match patterns inside class definitions.'
                    },
                    hasPattern: {
                        type: 'string',
                        description: 'Optional: pattern that must exist inside the match. Example: "if ($COND) { $$$ }" to only match if statements with conditions.'
                    },
                    notPattern: {
                        type: 'string',
                        description: 'Optional: pattern that must NOT exist inside the match. Example: "console.log($_)" to exclude console.log calls that are inside try-catch blocks.'
                    },
                    where: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                metavariable: { type: 'string', description: 'Metavariable name to constrain (e.g., "NAME", "ARGS")' },
                                regex: { type: 'string', description: 'Regex pattern the metavariable must match' },
                                notRegex: { type: 'string', description: 'Regex pattern the metavariable must NOT match' },
                                equals: { type: 'string', description: 'Exact string the metavariable must equal' },
                                includes: { type: 'string', description: 'String the metavariable must include' },
                            },
                            required: ['metavariable']
                        },
                        description: 'Optional: constraints on metavariables using regex, equals, or includes. Example: [{"metavariable": "NAME", "regex": "^[A-Z]"}] to only match names starting with uppercase.'
                    },
                    fix: {
                        type: 'string',
                        description: 'Optional rewrite template using the same metavariables as pattern. Enables automatic fixing. Example: "logger.info($_)" to replace "console.log($_)" with "logger.info($_)".'
                    },
                    // Scan fields
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Files/directories to scan. IMPORTANT: Use absolute paths for file-based scanning (e.g., "D:\\path\\to\\file.js"). Relative paths may not resolve correctly due to workspace detection issues.'
                    },
                    format: {
                        type: 'string',
                        enum: ['json', 'text', 'github'],
                        default: 'json',
                        description: 'Output format for results. "json" for structured data, "text" for human-readable, "github" for GitHub Actions format.'
                    },
                    include: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Include glob patterns for file filtering. Example: ["**/*.js", "**/*.ts"] to only scan JavaScript/TypeScript files.'
                    },
                    exclude: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Exclude glob patterns. Default excludes: node_modules, .git, dist, build, coverage, *.min.js, *.bundle.js, .next, .vscode, .idea'
                    },
                    ruleIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Specific rule IDs to run (filters results). Only run rules with these IDs from the rules file.'
                    },
                    timeoutMs: {
                        type: 'number',
                        minimum: 1000,
                        maximum: 180000,
                        description: 'Timeout for ast-grep scan in milliseconds (default: 30000)'
                    },
                    relativePaths: {
                        type: 'boolean',
                        default: false,
                        description: 'Return file paths relative to workspace root instead of absolute paths'
                    },
                    follow: {
                        type: 'boolean',
                        default: false,
                        description: 'Follow symlinks during file scanning'
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
                        description: 'Disable ignore rules and scan all files including node_modules, .git, etc. Use with caution as it may scan large amounts of files and hit resource limits.'
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
                    saveTo: {
                        type: 'string',
                        description: 'Optional path to save the generated YAML rule file (relative to workspace). Example: "rules/my-rule.yml" to save the generated rule for reuse.'
                    },
                },
                required: ['id', 'language', 'pattern']
            }
        };
    }
    async execute(params) {
        // Validate rule params
        const ruleValidation = this.validator.validateRuleBuilderParams(params);
        if (!ruleValidation.valid) {
            throw new Error(`Invalid rule parameters: ${ruleValidation.errors.join(', ')}`);
        }
        const rule = ruleValidation.sanitized;
        // Build YAML
        const yaml = this.buildYaml(rule);
        // Build scan params and validate
        // Default to current working directory if no paths specified to avoid scanning entire system
        const defaultPaths = params.paths || [process.cwd()];
        const scanParams = {
            rules: yaml,
            paths: defaultPaths,
            format: params.format || 'json',
            severity: params.severity || 'all',
            ruleIds: params.ruleIds,
            include: params.include,
            exclude: params.exclude,
            timeoutMs: params.timeoutMs,
            relativePaths: params.relativePaths,
            jsonStyle: params.jsonStyle,
            follow: params.follow,
            threads: params.threads,
            noIgnore: params.noIgnore,
            ignorePath: params.ignorePath,
            root: params.root,
            workdir: params.workdir,
        };
        const scanValidation = this.validator.validateScanParams(scanParams);
        if (!scanValidation.valid) {
            throw new Error(`Invalid scan parameters: ${scanValidation.errors.join(', ')}`);
        }
        // Save YAML to workspace
        let savedPath;
        if (params.saveTo && typeof params.saveTo === 'string' && params.saveTo.trim().length > 0) {
            const validation = this.workspaceManager.validatePath(params.saveTo);
            if (!validation.valid) {
                throw new Error(`Invalid save path: ${validation.error}`);
            }
            const outPath = validation.resolvedPath.endsWith('.yml') || validation.resolvedPath.endsWith('.yaml')
                ? validation.resolvedPath
                : validation.resolvedPath + '.yml';
            await fs.mkdir(path.dirname(outPath), { recursive: true });
            await fs.writeFile(outPath, yaml, 'utf8');
            savedPath = outPath;
        }
        else {
            // Default auto-save into .tree-ast-grep/rules/<id>.yml at workspace root
            const defaultRel = path.join('.tree-ast-grep', 'rules', `${rule.id}.yml`);
            const validation = this.workspaceManager.validatePath(defaultRel);
            if (!validation.valid) {
                throw new Error(`Invalid default save path: ${validation.error}`);
            }
            await fs.mkdir(path.dirname(validation.resolvedPath), { recursive: true });
            await fs.writeFile(validation.resolvedPath, yaml, 'utf8');
            savedPath = validation.resolvedPath;
        }
        const scanResult = await this.scanTool.execute(scanValidation.sanitized);
        return { yaml, scan: scanResult, savedPath };
    }
    buildYaml(p) {
        const lines = [];
        lines.push('# ast-grep rule generated by ast_run_rule');
        lines.push('# Tips:');
        lines.push('# - Use $VAR for single node capture, $$$ for multi-node');
        lines.push('# - Add inside/has/not patterns to narrow results');
        lines.push('# - Use where to constrain metavariables (regex, equals, includes)');
        lines.push(`id: ${p.id}`);
        lines.push(`message: ${JSON.stringify(p.message || p.id)}`);
        lines.push(`severity: ${p.severity || 'warning'}`);
        lines.push(`language: ${p.language}`);
        lines.push(`rule:`);
        lines.push(`  pattern: ${JSON.stringify(p.pattern)}`);
        if (p.kind)
            lines.push(`  kind: ${JSON.stringify(p.kind)}`);
        if (p.insidePattern)
            lines.push(`  inside: { pattern: ${JSON.stringify(p.insidePattern)} }`);
        if (p.hasPattern)
            lines.push(`  has: { pattern: ${JSON.stringify(p.hasPattern)} }`);
        if (p.notPattern)
            lines.push(`  not: { pattern: ${JSON.stringify(p.notPattern)} }`);
        if (p.where && p.where.length > 0) {
            lines.push('  where:');
            for (const w of p.where) {
                const row = [];
                row.push(`metavariable: ${w.metavariable}`);
                if (w.regex)
                    row.push(`regex: ${JSON.stringify(w.regex)}`);
                if (w.notRegex)
                    row.push(`not: { regex: ${JSON.stringify(w.notRegex)} }`);
                if (w.equals)
                    row.push(`equals: ${JSON.stringify(w.equals)}`);
                if (w.includes)
                    row.push(`includes: ${JSON.stringify(w.includes)}`);
                lines.push(`    - ${row.join(', ')}`);
            }
        }
        if (p.fix)
            lines.push(`  fix: ${JSON.stringify(p.fix)}`);
        return lines.join('\n');
    }
}
//# sourceMappingURL=rule-builder.js.map