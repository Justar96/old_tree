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
            description: 'Generate an ast-grep YAML rule and immediately run ast_scan with it',
            inputSchema: {
                type: 'object',
                properties: {
                    // Rule fields
                    id: { type: 'string', description: 'Rule ID (unique and descriptive)' },
                    language: { type: 'string', description: 'Language for the rule (e.g., javascript, typescript, python)' },
                    pattern: { type: 'string', description: 'Primary pattern with metavariables ($VAR, $$$) describing the match' },
                    message: { type: 'string', description: 'Human-readable message explaining the finding' },
                    severity: { type: 'string', enum: ['error', 'warning', 'info'], default: 'warning', description: 'Severity level for rule' },
                    kind: { type: 'string', description: 'Optional node kind to constrain matches (language-specific)' },
                    insidePattern: { type: 'string', description: 'Optional: pattern that the match must be inside of' },
                    hasPattern: { type: 'string', description: 'Optional: pattern that must exist inside the match' },
                    notPattern: { type: 'string', description: 'Optional: pattern that must NOT exist inside the match' },
                    where: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                metavariable: { type: 'string' },
                                regex: { type: 'string' },
                                notRegex: { type: 'string' },
                                equals: { type: 'string' },
                                includes: { type: 'string' },
                            },
                            required: ['metavariable']
                        },
                        description: 'Optional: constraints on metavariables (regex, equals, includes)'
                    },
                    fix: { type: 'string', description: 'Optional rewrite template using the same metavariables' },
                    // Scan fields
                    paths: { type: 'array', items: { type: 'string' }, description: 'Files/directories to scan' },
                    format: { type: 'string', enum: ['json', 'text', 'github'], default: 'json' },
                    include: { type: 'array', items: { type: 'string' } },
                    exclude: { type: 'array', items: { type: 'string' } },
                    ruleIds: { type: 'array', items: { type: 'string' } },
                    timeoutMs: { type: 'number', minimum: 1000, maximum: 180000 },
                    relativePaths: { type: 'boolean', default: false },
                    jsonStyle: { type: 'string', enum: ['stream', 'pretty', 'compact'], default: 'stream' },
                    follow: { type: 'boolean', default: false },
                    threads: { type: 'number', minimum: 1, maximum: 64 },
                    noIgnore: { type: 'boolean', default: false },
                    ignorePath: { type: 'array', items: { type: 'string' } },
                    root: { type: 'string' },
                    workdir: { type: 'string' },
                    saveTo: { type: 'string', description: 'Optional path to save the generated YAML (relative to workspace)' },
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
        const scanParams = {
            rules: yaml,
            paths: params.paths,
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
        lines.push('rules:');
        lines.push(`  - id: ${p.id}`);
        lines.push(`    message: ${JSON.stringify(p.message || p.id)}`);
        lines.push(`    severity: ${p.severity || 'warning'}`);
        lines.push(`    language: ${p.language}`);
        lines.push(`    pattern: ${JSON.stringify(p.pattern)}`);
        if (p.kind)
            lines.push(`    kind: ${JSON.stringify(p.kind)}`);
        if (p.insidePattern)
            lines.push(`    inside: { pattern: ${JSON.stringify(p.insidePattern)} }`);
        if (p.hasPattern)
            lines.push(`    has: { pattern: ${JSON.stringify(p.hasPattern)} }`);
        if (p.notPattern)
            lines.push(`    not: { pattern: ${JSON.stringify(p.notPattern)} }`);
        if (p.where && p.where.length > 0) {
            lines.push('    where:');
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
                lines.push(`      - ${row.join(', ')}`);
            }
        }
        if (p.fix)
            lines.push(`    fix: ${JSON.stringify(p.fix)}`);
        return lines.join('\n');
    }
}
//# sourceMappingURL=rule-builder.js.map