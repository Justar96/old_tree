import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { BaseTool } from '../core/tool-base.js';
import { AstGrepErrorTranslator } from '../core/error-handler.js';
import { ValidationError, ExecutionError } from '../types/errors.js';
import { ScanParams, ScanResult } from '../types/schemas.js';

/**
 * Executes ast-grep scan operations and aggregates diagnostics for MCP clients.
 */
export class ScanTool extends BaseTool {
  /**
   * Initialize the scan tool with workspace context and binary execution support.
   */
  constructor(
    binaryManager: AstGrepBinaryManager,
    workspaceManager: WorkspaceManager
  ) {
    super(workspaceManager, binaryManager);
  }

  /**
   * Run ast-grep scan with validation and enrich the output with summary metrics.
   */
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

    // Use enhanced path resolution from BaseTool
    const defaultPaths = sanitizedParams.paths || ['.'];

    // Validate resource limits
    const resourceValidation = await this.validator.validateResourceLimits(defaultPaths);
    if (!resourceValidation.valid) {
      throw new ValidationError('Resource limits exceeded', {
        errors: resourceValidation.errors,
        params: sanitizedParams
      });
    }

    // Use unified path resolution
    const pathResolution = await this.resolveAndValidatePaths(defaultPaths);
    const resolvedPaths = pathResolution.targets;

    try {
      let findings: ScanResult['findings'] = [];
      let filesScanned = 0;

      if (sanitizedParams.rules) {
        // Use custom rules file or inline rules
        const result = await this.scanWithRules(sanitizedParams, resolvedPaths);
        findings = result.findings;
        filesScanned = result.filesScanned;
      } else {
        // Use built-in rules or scan without specific rules
        const result = await this.scanWithoutRules(sanitizedParams, resolvedPaths);
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

      // Use enhanced error handling from BaseTool
      const contextualError = AstGrepErrorTranslator.createUserFriendlyError(
        error instanceof Error ? error : new Error(String(error)),
        {
          paths: sanitizedParams.paths,
          rules: sanitizedParams.rules,
          workspace: this.getWorkspaceRoot()
        }
      );

      throw contextualError;
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
      const filesScanned = this.extractFilesScanned(result.stderr, findings, resolvedPaths);

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

    // Convert multi-rule format to single-rule format if needed
    let processedContent = rulesContent;
    if (rulesContent.includes('rules:') && rulesContent.includes('- id:')) {
      // Convert from multi-rule to single-rule format
      const lines = rulesContent.split('\n');
      let inRules = false;
      let currentRule: string[] = [];
      const singleRules: string[] = [];
      
      for (const line of lines) {
        if (line.trim() === 'rules:') {
          inRules = true;
          continue;
        }
        
        if (inRules && line.trim().startsWith('- id:')) {
          if (currentRule.length > 0) {
            singleRules.push(currentRule.join('\n'));
          }
          currentRule = [line.replace(/^\s*-\s*/, '')];
        } else if (inRules && line.trim() && !line.trim().startsWith('#')) {
          currentRule.push(line.replace(/^\s*/, '  '));
        }
      }
      
      if (currentRule.length > 0) {
        singleRules.push(currentRule.join('\n'));
      }
      
      // Use the first rule for single-rule format
      if (singleRules.length > 0) {
        processedContent = singleRules[0];
      }
    }

    await fs.writeFile(rulesFile, processedContent, 'utf8');
    return rulesFile;
  }

  private buildScanArgs(params: ScanParams, resolvedPaths: string[], rulesFile: string | null): string[] {
    const args: string[] = ['scan'];

    // Add rules file if specified (use --rule for single rule files)
    if (rulesFile) {
      args.push('--rule', rulesFile);
    }

    // Use BaseTool methods for consistent parameter handling
    args.push(...this.buildCommonArgs(params));

    // Add JSON output format for scan (different from search/run tools)
    if (params.format === 'json') {
      args.push(...this.buildJsonArgs(params.jsonStyle));
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

    // NEW: Use workspace file enumeration as fallback for scan operations
    // This addresses the critical issue where ast-grep scan doesn't report file counts
    if (resolvedPaths && resolvedPaths.length > 0) {
      return this.countFilesInPaths(resolvedPaths);
    }

    return 0;
  }

  private countFilesInPaths(paths: string[]): number {
    let totalFiles = 0;

    for (const inputPath of paths) {
      try {
        const stats = fsSync.statSync(inputPath);

        if (stats.isFile()) {
          // Single file
          totalFiles += 1;
        } else if (stats.isDirectory()) {
          // Directory - count JavaScript/TypeScript files
          totalFiles += this.countFilesInDirectory(inputPath);
        }
      } catch (error) {
        // Skip inaccessible paths
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Warning: Cannot access path ${inputPath}:`, errorMessage);
      }
    }

    return totalFiles;
  }

  private countFilesInDirectory(dirPath: string): number {

    let count = 0;
    const visited = new Set(); // Prevent infinite loops from symlinks

    const scanDir = (currentPath: string, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 10 || visited.has(currentPath)) return;
      visited.add(currentPath);

      try {
        const items = fsSync.readdirSync(currentPath);

        for (const item of items) {
          // Skip common directories that shouldn't be scanned
          if (['node_modules', '.git', 'build', 'dist', '.next', 'coverage'].includes(item)) {
            continue;
          }

          const itemPath = path.join(currentPath, item);

          try {
            const stats = fsSync.statSync(itemPath);

            if (stats.isFile()) {
              // Count files that ast-grep would typically process
              const ext = path.extname(item).toLowerCase();
              if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.py', '.java', '.rs', '.go', '.cpp', '.c', '.h'].includes(ext)) {
                count++;
              }
            } else if (stats.isDirectory() && !item.startsWith('.')) {
              scanDir(itemPath, depth + 1);
            }
          } catch (error) {
            // Skip inaccessible files/directories
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    scanDir(dirPath);
    return count;
  }

  // Get tool schema for MCP
  /**
   * Describe the MCP schema for the scan tool.
   */
  static getSchema() {
    return {
      name: 'ast_scan',
      description: 'Scan code with ast-grep rules for analysis and linting. Use YAML rule files to define custom patterns for code analysis, security checks, and style enforcement. BEST PRACTICE: Use absolute paths for file-based scanning.',
      inputSchema: {
        type: 'object',
        properties: {
          rules: {
            type: 'string',
            description: 'Path to YAML rules file (.yml/.yaml) or inline YAML rules content. ADVANCED RULE COMPOSITION: Use "all:", "any:", "not:" for complex logic, "inside:", "has:" for context, "constraints:" for metavariable filtering. Example: "rules.yml" or inline YAML: "rules:\\n  - id: no-console\\n    rule:\\n      pattern: console.log($_)\\n    message: Avoid console.log\\n    severity: warning\\n    language: javascript"'
          },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files/directories to scan. IMPORTANT: Use absolute paths for file-based scanning (e.g., "D:\\path\\to\\file.js"). Relative paths may not resolve correctly due to workspace detection issues. Default: current directory if no paths specified.'
          },
          format: {
            type: 'string',
            enum: ['json', 'text', 'github'],
            default: 'json',
            description: 'Output format for results. "json" for structured data, "text" for human-readable, "github" for GitHub Actions format.'
          },
          severity: {
            type: 'string',
            enum: ['error', 'warning', 'info', 'all'],
            default: 'all',
            description: 'Filter findings by severity level. "error" for critical issues, "warning" for important issues, "info" for suggestions, "all" for everything.'
          },
          ruleIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific rule IDs to run (filters results). Only run rules with these IDs from the rules file.'
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
          timeoutMs: {
            type: 'number',
            minimum: 1000,
            maximum: 180000,
            description: 'Timeout for ast-grep scan in milliseconds. Default: 60000 (60 seconds). Higher limit for complex rule analysis.'
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
          }
        },
        required: ['rules']
      }
    };
  }
}

