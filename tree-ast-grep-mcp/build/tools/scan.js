import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ValidationError } from '../types/errors.js';
/**
 * Rule builder that generates YAML and runs ast-grep scan
 */
export class ScanTool {
    workspaceManager;
    binaryManager;
    constructor(workspaceManager, binaryManager) {
        this.workspaceManager = workspaceManager;
        this.binaryManager = binaryManager;
    }
    async execute(params) {
        // Basic validation
        if (!params.id || !params.language || !params.pattern) {
            throw new ValidationError('id, language, and pattern are required');
        }
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
        // Generate simple YAML rule
        const yaml = this.buildYaml({ ...params, language: normalizeLang(params.language) });
        // Create temporary rule file
        const tempDir = os.tmpdir();
        const rulesFile = path.join(tempDir, `rule-${Date.now()}.yml`);
        let tempCodeFileForCleanup = null;
        try {
            await fs.writeFile(rulesFile, yaml, 'utf8');
            // Build scan command
            const args = ['scan', '--rule', rulesFile, '--json=stream'];
            // Add paths or inline code via temp file
            let tempCodeFile = null;
            if (params.code) {
                const extMap = { js: 'js', ts: 'ts', jsx: 'jsx', tsx: 'tsx' };
                const ext = extMap[normalizeLang(params.language)] || 'js';
                tempCodeFile = path.join(os.tmpdir(), `astgrep-inline-${Date.now()}.${ext}`);
                await fs.writeFile(tempCodeFile, params.code, 'utf8');
                args.push(tempCodeFile);
                tempCodeFileForCleanup = tempCodeFile;
            }
            else {
                const inputPaths = params.paths && Array.isArray(params.paths) && params.paths.length > 0 ? params.paths : ['.'];
                const { valid, resolvedPaths, errors } = this.workspaceManager.validatePaths(inputPaths);
                if (!valid) {
                    throw new ValidationError('Invalid paths', { errors });
                }
                args.push(...resolvedPaths);
            }
            const result = await this.binaryManager.executeAstGrep(args, {
                cwd: this.workspaceManager.getWorkspaceRoot(),
                timeout: params.timeoutMs || 30000
            });
            const findings = this.parseFindings(result.stdout);
            const resultObj = {
                yaml,
                scan: {
                    findings,
                    summary: {
                        totalFindings: findings.length,
                        errors: findings.filter(f => f.severity === 'error').length,
                        warnings: findings.filter(f => f.severity === 'warning').length
                    }
                }
            };
            return resultObj;
        }
        finally {
            // Cleanup
            try {
                await fs.unlink(rulesFile);
            }
            catch { }
            if (tempCodeFileForCleanup) {
                try {
                    await fs.unlink(tempCodeFileForCleanup);
                }
                catch { }
            }
        }
    }
    buildYaml(params) {
        const lines = [
            `id: ${params.id}`,
            `message: ${JSON.stringify(params.message || params.id)}`,
            `severity: ${params.severity || 'warning'}`,
            `language: ${params.language}`,
            'rule:',
            `  pattern: ${JSON.stringify(params.pattern)}`
        ];
        // Add simple constraints if provided
        if (params.where && params.where.length > 0) {
            lines.push('  constraints:');
            for (const constraint of params.where) {
                lines.push(`    ${constraint.metavariable}:`);
                if (constraint.regex) {
                    lines.push(`      regex: ${JSON.stringify(constraint.regex)}`);
                }
                else if (constraint.equals) {
                    const escaped = constraint.equals.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    lines.push(`      regex: ${JSON.stringify('^' + escaped + '$')}`);
                }
            }
        }
        // Add fix if provided
        if (params.fix) {
            lines.push(`fix: ${JSON.stringify(params.fix)}`);
        }
        return lines.join('\n');
    }
    parseFindings(stdout) {
        const findings = [];
        if (!stdout.trim())
            return findings;
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            try {
                const finding = JSON.parse(line);
                findings.push({
                    ruleId: finding.ruleId || 'unknown',
                    severity: finding.severity || 'info',
                    message: finding.message || '',
                    file: finding.file || '',
                    line: (finding.range?.start?.line || 0) + 1, // Convert to 1-based
                    column: finding.range?.start?.column || 0,
                    fix: finding.fix
                });
            }
            catch (e) {
                // Skip malformed lines
            }
        }
        return findings;
    }
    static getSchema() {
        return {
            name: 'ast_run_rule',
            description: '🚀 SIMPLIFIED: Generate and run ast-grep rules with minimal complexity. Fixed constraints and consistent behavior.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'Rule ID (e.g., "no-console-log")'
                    },
                    language: {
                        type: 'string',
                        description: 'Language: javascript, typescript, python, etc.'
                    },
                    pattern: {
                        type: 'string',
                        description: 'AST pattern: console.log($ARG), function $NAME($PARAMS) { $$$ }, etc.'
                    },
                    message: {
                        type: 'string',
                        description: 'Human-readable message for findings'
                    },
                    severity: {
                        type: 'string',
                        enum: ['error', 'warning', 'info'],
                        default: 'warning',
                        description: 'Severity level'
                    },
                    where: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                metavariable: { type: 'string' },
                                regex: { type: 'string' },
                                equals: { type: 'string' }
                            },
                            required: ['metavariable']
                        },
                        description: 'Constraints on metavariables'
                    },
                    fix: {
                        type: 'string',
                        description: 'Optional fix template'
                    },
                    paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Paths to scan'
                    },
                    timeoutMs: {
                        type: 'number',
                        default: 30000,
                        description: 'Timeout in milliseconds'
                    }
                },
                required: ['id', 'language', 'pattern']
            }
        };
    }
}
//# sourceMappingURL=scan.js.map