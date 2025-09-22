import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { ParameterValidator } from '../core/validator.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
import { ScanParams, ScanResult } from '../types/schemas.js';

export class ScanTool {
  private binaryManager: AstGrepBinaryManager;
  private validator: ParameterValidator;
  private workspaceManager: WorkspaceManager;

  constructor(
    binaryManager: AstGrepBinaryManager,
    workspaceManager: WorkspaceManager
  ) {
    this.binaryManager = binaryManager;
    this.workspaceManager = workspaceManager;
    this.validator = new ParameterValidator(workspaceManager.getWorkspaceRoot());
  }

  async execute(params: ScanParams): Promise<ScanResult> {
    // Validate parameters
    const validation = this.validator.validateScanParams(params);
    if (!validation.valid) {
      throw new ValidationError('Invalid scan parameters', {
        errors: validation.errors,
        params
      });
    }

    const sanitizedParams = validation.sanitized as ScanParams;

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

    try {
      let findings: ScanResult['findings'] = [];
      let filesScanned = 0;

      if (sanitizedParams.rules) {
        // Use custom rules file or inline rules
        const result = await this.scanWithRules(sanitizedParams, pathValidation.resolvedPaths);
        findings = result.findings;
        filesScanned = result.filesScanned;
      } else {
        // Use built-in rules or scan without specific rules
        const result = await this.scanWithoutRules(sanitizedParams, pathValidation.resolvedPaths);
        findings = result.findings;
        filesScanned = result.filesScanned;
      }

      // Filter by severity if specified
      if (sanitizedParams.severity && sanitizedParams.severity !== 'all') {
        findings = findings.filter(finding => finding.severity === sanitizedParams.severity);
      }

      // Filter by rule IDs if specified
      if (sanitizedParams.ruleIds && sanitizedParams.ruleIds.length > 0) {
        findings = findings.filter(finding =>
          sanitizedParams.ruleIds!.includes(finding.ruleId)
        );
      }

      return {
        findings,
        summary: {
          totalFindings: findings.length,
          errors: findings.filter(f => f.severity === 'error').length,
          warnings: findings.filter(f => f.severity === 'warning').length,
          filesScanned
        }
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Try to translate ast-grep errors to user-friendly messages
      const friendlyMessage = this.validator.translateAstGrepError(errorMessage);

      throw new ExecutionError(
        `Scan execution failed: ${friendlyMessage}`,
        { params: sanitizedParams, originalError: error }
      );
    }
  }

  private async scanWithRules(params: ScanParams, resolvedPaths: string[]): Promise<{ findings: ScanResult['findings']; filesScanned: number }> {
    // Create temporary rules file if inline rules provided
    let rulesFile: string | null = null;

    if (params.rules && !params.rules.endsWith('.yml') && !params.rules.endsWith('.yaml')) {
      // Inline rules - create temporary file
      rulesFile = await this.createTemporaryRulesFile(params.rules);
    } else if (params.rules) {
      // Rules file path - validate it exists
      const rulesPath = path.resolve(this.workspaceManager.getWorkspaceRoot(), params.rules);
      const pathValidation = this.workspaceManager.validatePath(params.rules);
      if (!pathValidation.valid) {
        throw new ValidationError(`Invalid rules file path: ${pathValidation.error}`);
      }
      rulesFile = pathValidation.resolvedPath;
    }

    try {
      // Build ast-grep command arguments
      const args = this.buildScanArgs(params, resolvedPaths, rulesFile);

      // Execute ast-grep
      const result = await this.binaryManager.executeAstGrep(args, {
        cwd: this.workspaceManager.getWorkspaceRoot(),
        timeout: params.timeoutMs ?? 60000
      });

      // Parse results
      const findings = this.parseScanResults(result.stdout);
      const filesScanned = this.extractFilesScanned(result.stderr);

      return { findings, filesScanned };

    } finally {
      // Clean up temporary rules file
      if (rulesFile && params.rules && !params.rules.endsWith('.yml') && !params.rules.endsWith('.yaml')) {
        try {
          await fs.unlink(rulesFile);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  private async scanWithoutRules(params: ScanParams, resolvedPaths: string[]): Promise<{ findings: ScanResult['findings']; filesScanned: number }> {
    // For now, return empty results as we don't have built-in rules
    // In a full implementation, you might include common security/style rules
    return {
      findings: [],
      filesScanned: 0
    };
  }

  private async createTemporaryRulesFile(rulesContent: string): Promise<string> {
    const tempDir = os.tmpdir();
    const rulesFile = path.join(tempDir, `ast-grep-rules-${Date.now()}.yml`);

    await fs.writeFile(rulesFile, rulesContent, 'utf8');
    return rulesFile;
  }

  private buildScanArgs(params: ScanParams, resolvedPaths: string[], rulesFile: string | null): string[] {
    const args: string[] = ['scan'];

    // Add rules file if specified (use -c/--config for rule files)
    if (rulesFile) {
      args.push('--config', rulesFile);
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

    // Add JSON output format
    if (params.format === 'json') {
      args.push(`--json=${params.jsonStyle || 'stream'}`);
    }

    // Follow symlinks
    if (params.follow) {
      args.push('--follow');
    }

    // Threads
    if (params.threads) {
      args.push('--threads', String(params.threads));
    }

    // Add paths (must come after options)
    args.push(...resolvedPaths);

    return args;
  }

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
        let currentFinding: Partial<ScanResult['findings'][0]> | null = null;

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

  private parseSingleFinding(finding: any): ScanResult['findings'][0] {
    const file = finding.file || finding.path || '';
    const line = finding.line ?? finding.start?.line ?? 0;
    const column = finding.column ?? finding.start?.column ?? 0;
    return {
      ruleId: finding.ruleId || finding.id || 'unknown',
      severity: finding.severity || finding.level || 'info',
      message: finding.message || finding.text || '',
      file,
      line: typeof line === 'number' ? line : Number(line),
      column: typeof column === 'number' ? column : Number(column),
      fix: finding.fix || finding.suggestion
    };
  }

  private extractFilesScanned(stderr: string): number {
    // Try to extract file count from stderr
    const fileCountMatch = stderr.match(/(\d+)\s+files?\s+scanned/i);
    if (fileCountMatch) {
      return parseInt(fileCountMatch[1], 10);
    }

    return 0;
  }

  // Get tool schema for MCP
  static getSchema() {
    return {
      name: 'ast_scan',
      description: 'Scan code with ast-grep rules for analysis and linting',
      inputSchema: {
        type: 'object',
        properties: {
          rules: {
            type: 'string',
            description: 'Path to rules file (.yml/.yaml) or inline YAML rules content'
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files/directories to scan (default: current directory)'
          },
          format: {
            type: 'string',
            enum: ['json', 'text', 'github'],
            default: 'json',
            description: 'Output format for results'
          },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info', 'all'],
            default: 'all',
            description: 'Filter findings by severity level'
          },
          ruleIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific rule IDs to run (filters results)'
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
            maximum: 180000,
            description: 'Timeout for ast-grep scan in milliseconds'
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
            description: 'Follow symlinks during scan'
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
          }
        }
      }
    };
  }
}