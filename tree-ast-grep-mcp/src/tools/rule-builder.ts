import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BaseTool } from '../core/tool-base.js';
import { EnhancedPatternValidator } from '../core/pattern-validator.js';
import { AstGrepErrorTranslator } from '../core/error-handler.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
import { RuleBuilderParams, RuleBuilderResult, ScanResult, RunRuleParams } from '../types/schemas.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { AstGrepBinaryManager } from '../core/binary-manager.js';

export class RunRuleTool extends BaseTool {
  private patternValidator: EnhancedPatternValidator;

  constructor(workspaceManager: WorkspaceManager, binaryManager: AstGrepBinaryManager) {
    super(workspaceManager, binaryManager);
    this.patternValidator = new EnhancedPatternValidator(workspaceManager.getWorkspaceRoot());
  }

  static getSchema() {
    return {
      name: 'ast_run_rule',
      description: '✅ PREFERRED OVER ast_scan: Auto-generates perfect YAML rules with better reliability, error handling, and validation. Generate an ast-grep YAML rule and immediately execute it. ENHANCED with QA fixes: improved pattern reliability ($$$ vs $ARGS), fixed contextual patterns (inside:, has:), better error reporting. Perfect for creating custom linting rules, security checks, and code analysis patterns. BEST PRACTICE: Use absolute paths for file-based scanning.',
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
            description: 'Primary AST pattern with metavariables. ✅ ATOMIC PATTERNS: "console.log($ARG)" (simple matching), "function $NAME($PARAMS) { $BODY }" (structural matching). ✅ RELATIONAL PATTERNS: Use with insidePattern/hasPattern for contextual matching. ✅ COMPOSITE PATTERNS: Combine multiple conditions with boolean logic. ✅ PROVEN EXAMPLES: "console.log($ARG)" (find logging), "def $NAME($PARAMS): $BODY" (Python functions), "public $TYPE $METHOD($PARAMS) { $BODY }" (Java methods), "$OBJ.$METHOD($_)" (method calls). ⚠️ RELIABILITY: Use named metavariables ($NAME, $ARG) for reliable capture. Avoid $_ and $$$ in fix templates.'
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
            description: '✅ RELATIONAL RULE: Pattern that the match must be inside of. PROVEN EXAMPLES: "class $CLASS { $$$ }" (inside classes), "function $FUNC() { $$$ }" (inside functions), "if ($COND) { $$$ }" (inside conditionals), "try { $$$ }" (inside try blocks). USE CASES: Find console.log only inside functions, detect unsafe operations inside loops, locate deprecated APIs inside specific contexts.'
          },
          hasPattern: { 
            type: 'string', 
            description: '✅ RELATIONAL RULE: Pattern that must exist inside the match. PROVEN EXAMPLES: "console.log($ARG)" (functions containing logging), "await $PROMISE" (functions with async calls), "$EXCEPTION" (catch blocks with specific errors), "return $VALUE" (functions that return values). ADVANCED: "{ kind: method_definition }" (classes with methods), "@$ANNOTATION" (decorated elements).'
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
            description: '⚠️ PATH REQUIREMENTS: REQUIRED: Use absolute paths for file operations (e.g., "D:\\path\\to\\file.js"). ❌ FAILS: Relative paths like "src/file.ts" may not resolve correctly due to workspace detection issues. ✅ WORKS: Absolute paths like "d:/project/src/file.ts" for reliable file resolution.'
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

  async execute(params: RunRuleParams): Promise<{ yaml: string; scan: ScanResult; savedPath?: string }> {
    try {
      // Validate rule params
      const ruleValidation = this.validator.validateRuleBuilderParams(params);
      if (!ruleValidation.valid) {
        throw new ValidationError(`Invalid rule parameters: ${ruleValidation.errors.join(', ')}`);
      }
      const rule = ruleValidation.sanitized as RuleBuilderParams;

      // Build YAML
      const yaml = this.buildYaml(rule);

      // Execute rule directly using generated YAML

      // Save YAML to workspace
      let savedPath: string | undefined;
      if (params.saveTo && typeof params.saveTo === 'string' && params.saveTo.trim().length > 0) {
        const validation = this.workspaceManager.validatePath(params.saveTo);
        if (!validation.valid) {
          throw new ValidationError(`Invalid save path: ${validation.error}`);
        }
        const outPath = validation.resolvedPath.endsWith('.yml') || validation.resolvedPath.endsWith('.yaml')
          ? validation.resolvedPath
          : validation.resolvedPath + '.yml';
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, yaml, 'utf8');
        savedPath = outPath;
      } else {
        // Default auto-save into .tree-ast-grep/rules/<id>.yml at workspace root
        const defaultRel = path.join('.tree-ast-grep', 'rules', `${rule.id}.yml`);
        const validation = this.workspaceManager.validatePath(defaultRel);
        if (!validation.valid) {
          throw new ValidationError(`Invalid default save path: ${validation.error}`);
        }
        await fs.mkdir(path.dirname(validation.resolvedPath), { recursive: true });
        await fs.writeFile(validation.resolvedPath, yaml, 'utf8');
        savedPath = validation.resolvedPath;
      }

      const scanResult = await this.executeRule(yaml, params);
      return { yaml, scan: scanResult, savedPath };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      // Use enhanced error handling
      const contextualError = AstGrepErrorTranslator.createUserFriendlyError(
        error instanceof Error ? error : new Error(String(error)),
        {
          ruleId: params.id,
          pattern: params.pattern,
          language: params.language,
          paths: params.paths,
          workspace: this.workspaceManager.getWorkspaceRoot()
        }
      );

      throw contextualError;
    }
  }

  private buildYaml(p: RuleBuilderParams): string {
    const lines: string[] = [];
    lines.push('# ast-grep rule generated by ast_run_rule');
    lines.push('# Pattern syntax: $VAR (single node), $$$ (multi-node), $NAME (capture names)');
    lines.push('# Rule composition: use inside/has/not for contextual matching');
    lines.push('# Constraints: use where clauses for metavariable filtering');
    lines.push(`id: ${p.id}`);
    lines.push(`message: ${JSON.stringify(p.message || p.id)}`);
    lines.push(`severity: ${p.severity || 'warning'}`);
    lines.push(`language: ${p.language}`);

    // Build rule object with proper YAML structure
    lines.push('rule:');

    // Determine if we need complex rule structure
    const hasContextualPatterns = p.insidePattern || p.hasPattern || p.notPattern;
    const hasConstraints = p.where && p.where.length > 0;
    const hasComplexRule = hasContextualPatterns || hasConstraints;

    if (hasComplexRule) {
      // Use composite rule structure for complex patterns
      lines.push('  all:');

      // Primary pattern component
      lines.push('  - pattern: ' + JSON.stringify(p.pattern));
      if (p.kind) lines.push('    kind: ' + JSON.stringify(p.kind));

      // Add contextual patterns with proper nesting
      if (p.insidePattern) {
        lines.push('  - inside:');
        lines.push('      pattern: ' + JSON.stringify(p.insidePattern));
      }

      if (p.hasPattern) {
        lines.push('  - has:');
        lines.push('      pattern: ' + JSON.stringify(p.hasPattern));
      }

      if (p.notPattern) {
        lines.push('  - not:');
        lines.push('      pattern: ' + JSON.stringify(p.notPattern));
      }
    } else {
      // Simple pattern structure
      lines.push(`  pattern: ${JSON.stringify(p.pattern)}`);
      if (p.kind) lines.push(`  kind: ${JSON.stringify(p.kind)}`);
    }

    // Add metavariable constraints at the top level after rule
    if (hasConstraints && p.where) {
      lines.push('constraints:');
      for (const constraint of p.where) {
        lines.push(`  ${constraint.metavariable}:`);

        if (constraint.regex) {
          lines.push(`    regex: ${JSON.stringify(constraint.regex)}`);
        }
        if (constraint.notRegex) {
          lines.push(`    not:`);
          lines.push(`      regex: ${JSON.stringify(constraint.notRegex)}`);
        }
        if (constraint.equals) {
          lines.push(`    equals: ${JSON.stringify(constraint.equals)}`);
        }
        if (constraint.includes) {
          lines.push(`    matches: ${JSON.stringify('.*' + constraint.includes + '.*')}`);
        }
      }
    }

    // Add fix template if provided
    if (p.fix) {
      lines.push(`fix: ${JSON.stringify(p.fix)}`);
    }

    return lines.join('\n');
  }

  /**
   * Execute the generated YAML rule directly using ast-grep
   */
  private async executeRule(yaml: string, params: RunRuleParams): Promise<ScanResult> {
    // Use enhanced path resolution from BaseTool
    const defaultPaths = params.paths || ['.'];
    const pathResolution = await this.resolveAndValidatePaths(defaultPaths);
    const resolvedPaths = pathResolution.targets;

    // Create temporary rules file
    const tempDir = os.tmpdir();
    const rulesFile = path.join(tempDir, `ast-grep-rule-${Date.now()}.yml`);
    
    try {
      await fs.writeFile(rulesFile, yaml, 'utf8');

      // Build ast-grep command arguments
      const args = this.buildScanArgs(params, resolvedPaths, rulesFile);

      // Execute ast-grep
      const result = await this.binaryManager.executeAstGrep(args, {
        cwd: this.getWorkspaceRoot(),
        timeout: params.timeoutMs ?? 60000
      });

      // Parse results
      const findings = this.parseScanResults(result.stdout);
      const filesScanned = this.extractFilesScanned(result.stderr, findings, resolvedPaths);

      // Filter by severity if specified
      let filteredFindings = findings;
      if (params.severity && params.severity !== 'all') {
        filteredFindings = findings.filter(finding => finding.severity === params.severity);
      }

      return {
        findings: filteredFindings,
        summary: {
          totalFindings: filteredFindings.length,
          errors: filteredFindings.filter(f => f.severity === 'error').length,
          warnings: filteredFindings.filter(f => f.severity === 'warning').length,
          filesScanned
        }
      };

    } finally {
      // Clean up temporary rules file
      try {
        await fs.unlink(rulesFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Build ast-grep scan command arguments
   */
  private buildScanArgs(params: RunRuleParams, resolvedPaths: string[], rulesFile: string): string[] {
    const args: string[] = ['scan'];

    // Add rules file
    args.push('--rule', rulesFile);

    // Use BaseTool methods for consistent parameter handling
    args.push(...this.buildCommonArgs(params));

    // Add JSON output format
    if (params.format === 'json') {
      args.push(...this.buildJsonArgs(params.jsonStyle));
    }

    // Add paths (must come after options)
    args.push(...resolvedPaths);

    return args;
  }

  /**
   * Parse ast-grep scan results into ScanResult format
   */
  private parseScanResults(stdout: string): ScanResult['findings'] {
    const findings: ScanResult['findings'] = [];

    if (!stdout.trim()) {
      return findings;
    }

    try {
      // Try parsing stream JSONL first
      const trimmed = stdout.trim();
      if (trimmed.includes('\n') && trimmed.split('\n').every(l => l.trim().startsWith('{') || l.trim() === '')) {
        for (const line of trimmed.split('\n')) {
          const l = line.trim();
          if (!l) continue;
          const obj = JSON.parse(l);
          if (Array.isArray(obj.findings)) {
            for (const f of obj.findings) findings.push(this.parseSingleFinding(f));
          } else if (obj.ruleId || obj.file) {
            findings.push(this.parseSingleFinding(obj));
          }
        }
      } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // JSON format: pretty/compact
        const results = JSON.parse(trimmed);
        if (Array.isArray(results)) {
          for (const result of results) findings.push(this.parseSingleFinding(result));
        } else if (results.findings) {
          for (const finding of results.findings) findings.push(this.parseSingleFinding(finding));
        } else {
          findings.push(this.parseSingleFinding(results));
        }
      } else {
        // Text format - parse line by line
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.includes(':')) {
            // Parse file:line:column: message format
            const match = line.match(/^(.+?):(\d+):(\d+):\s*(.+)$/);
            if (match) {
              const [, file, lineNum, colNum, message] = match;
              findings.push({
                ruleId: 'unknown',
                severity: 'info',
                message: message.trim(),
                file: file.trim(),
                line: parseInt(lineNum, 10),
                column: parseInt(colNum, 10)
              });
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to parse ast-grep scan output:', errorMessage);
    }

    return findings;
  }

  /**
   * Parse a single finding from ast-grep output
   */
  private parseSingleFinding(finding: any): ScanResult['findings'][0] {
    const file = finding.file || finding.path || '';

    // Fix line number issues - ensure proper 1-based line numbers
    let line = finding.line ?? finding.range?.start?.line ?? finding.start?.line ?? 0;
    let column = finding.column ?? finding.range?.start?.column ?? finding.start?.column ?? 0;

    // Convert to numbers and handle invalid values
    line = typeof line === 'number' ? line : Number(line);
    column = typeof column === 'number' ? column : Number(column);

    // ast-grep may return 0-based lines in some contexts, ensure 1-based
    if (line <= 0) {
      line = 1; // Default to line 1 if invalid
    } else if (finding.range?.start?.line !== undefined) {
      // If we have range data, convert from 0-based to 1-based
      line = Number(finding.range.start.line) + 1;
    }

    // Ensure column is valid (0-based is acceptable for columns)
    if (column < 0) column = 0;

    return {
      ruleId: finding.ruleId || finding.id || 'unknown',
      severity: finding.severity || finding.level || 'info',
      message: finding.message || finding.text || '',
      file,
      line,
      column,
      fix: finding.fix || finding.suggestion
    };
  }

  /**
   * Extract files scanned count from stderr output
   */
  private extractFilesScanned(stderr: string, findings?: ScanResult['findings'], resolvedPaths?: string[]): number {
    // Try to extract file count from stderr with multiple patterns
    const patterns = [
      /(\d+)\s+files?\s+scanned/i,
      /(\d+)\s+files?\s+searched/i,
      /across\s+(\d+)\s+files?/i
    ];
    for (const re of patterns) {
      const m = stderr.match(re);
      if (m) return parseInt(m[1], 10);
    }

    // Enhanced fallback: count unique files from findings if provided
    if (findings && findings.length > 0) {
      const unique = new Set(findings.map(f => f.file));
      return unique.size;
    }

    // Use workspace file enumeration as fallback for scan operations
    if (resolvedPaths && resolvedPaths.length > 0) {
      return this.countFilesInPaths(resolvedPaths);
    }

    return 0;
  }

  /**
   * Count files in given paths for file scanning metrics
   */
  private countFilesInPaths(paths: string[]): number {
    // Simple estimation - in practice this would need full file enumeration
    // For now, return a reasonable default
    return Math.max(paths.length, 1);
  }
}
