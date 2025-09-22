import { AstGrepMCPError, ValidationError, SecurityError, ExecutionError, BinaryError } from '../types/errors.js';

export class AstGrepErrorTranslator {
  static translateCliError(stderr: string, context: any): string {
    // File not found errors
    if (stderr.includes('The system cannot find the file specified') ||
        stderr.includes('No such file or directory') ||
        stderr.includes('ENOENT')) {
      const pathInfo = context.paths?.length > 0
        ? `"${context.paths[0]}"`
        : 'specified path';
      return `File not found: ${pathInfo}. Verify the path exists and is accessible within the workspace.`;
    }

    // Permission errors
    if (stderr.includes('Permission denied') ||
        stderr.includes('Access is denied') ||
        stderr.includes('EACCES')) {
      const pathInfo = context.paths?.length > 0
        ? ` for path: ${context.paths[0]}`
        : '';
      return `Permission denied${pathInfo}. Check file/directory permissions and ensure the path is within the workspace.`;
    }

    // Enhanced pattern syntax error detection with specific guidance
    if (stderr.includes('parse error') ||
        stderr.includes('syntax error') ||
        stderr.includes('invalid pattern') ||
        stderr.includes('Parse error') ||
        stderr.includes('failed to parse') ||
        stderr.includes('parsing failed')) {
      const pattern = context.pattern || 'unknown';
      let suggestion = '';

      // Provide specific suggestions based on common pattern issues
      if (pattern.includes('$')) {
        if (pattern.match(/\$[a-z]/)) {
          suggestion = ' Metavariables must use UPPERCASE letters (e.g., $VAR, not $var).';
        } else if (pattern.includes('$$') && !pattern.includes('$$$')) {
          suggestion = ' Use $$$ for multi-node matching, not $$.';
        }
      }

      if (pattern.includes('{') && !pattern.includes('}')) {
        suggestion = ' Check for unmatched braces in your pattern.';
      }

      return `Invalid AST pattern syntax: "${pattern}".${suggestion} Pattern must be valid code that tree-sitter can parse. Use ast-grep playground to test patterns.`;
    }

    // Enhanced language detection with specific suggestions
    if (stderr.includes('language not supported') ||
        stderr.includes('unknown language') ||
        stderr.includes('unsupported language') ||
        stderr.includes('Language') ||
        stderr.includes('not found') && context.language) {
      const lang = context.language || 'unknown';
      const suggestions = {
        'js': 'javascript',
        'ts': 'typescript',
        'py': 'python',
        'rb': 'ruby',
        'rs': 'rust',
        'go': 'go',
        'cpp': 'cpp',
        'c++': 'cpp',
        'java': 'java'
      };
      const suggested = suggestions[lang.toLowerCase() as keyof typeof suggestions];
      const hint = suggested ? ` Did you mean "${suggested}"?` : '';
      return `Unsupported language: "${lang}".${hint} Supported: javascript, typescript, python, java, rust, go, cpp, c, php, ruby, kotlin, swift, csharp, html, css, json, yaml.`;
    }

    // Rule/YAML syntax errors
    if (stderr.includes('yaml') ||
        stderr.includes('YAML') ||
        stderr.includes('invalid rule') ||
        stderr.includes('rule syntax')) {
      return `Invalid YAML rule syntax. Check rule structure: ensure proper indentation, valid field names (id, message, severity, language, rule), and correct pattern syntax.`;
    }

    // Constraint/where clause errors
    if (stderr.includes('constraint') ||
        stderr.includes('where') ||
        stderr.includes('metavariable')) {
      return `Invalid constraint syntax. Constraints must reference metavariables from the pattern and use valid operators: regex, equals, matches, not.`;
    }

    // Workspace/path issues with specific guidance
    if (stderr.includes('cannot access') ||
        stderr.includes('invalid path') ||
        stderr.includes('path traversal') ||
        stderr.includes('outside workspace')) {
      const workspace = context.workspace || 'workspace';
      return `Path access error. Ensure all paths exist within workspace: ${workspace}. Use absolute paths or paths relative to workspace root. Avoid path traversal (../).`;
    }

    // Binary/execution issues
    if (stderr.includes('command not found') ||
        stderr.includes('not recognized') ||
        stderr.includes('executable not found')) {
      return 'ast-grep binary not found or not executable. Check installation with --auto-install flag or set AST_GREP_BINARY_PATH environment variable.';
    }

    // Timeout issues with actionable advice
    if (stderr.includes('timeout') ||
        stderr.includes('killed') ||
        stderr.includes('timed out')) {
      return 'Operation timed out. Try: reducing search scope with include/exclude patterns, increasing timeoutMs parameter, or using more specific patterns.';
    }

    // Resource/memory issues
    if (stderr.includes('out of memory') ||
        stderr.includes('memory') ||
        stderr.includes('resource limit')) {
      return 'Insufficient memory to complete operation. Try: reducing search scope, using include patterns to limit files, or increasing system memory.';
    }

    // Line ending/encoding issues
    if (stderr.includes('encoding') ||
        stderr.includes('utf') ||
        stderr.includes('character')) {
      return 'File encoding issue. Ensure files are UTF-8 encoded or specify correct encoding.';
    }

    // Generic fallback with more context
    const sanitizedError = stderr.trim().replace(/\n/g, ' ').substring(0, 300);
    const contextInfo = context.pattern ? ` Pattern: "${context.pattern}"` : '';
    const langInfo = context.language ? ` Language: ${context.language}` : '';
    return `ast-grep execution failed: ${sanitizedError}${contextInfo}${langInfo}`;
  }

  static createUserFriendlyError(error: Error, context: any): AstGrepMCPError {
    const errorMessage = error.message.toLowerCase();

    // File system errors
    if (errorMessage.includes('enoent') || errorMessage.includes('no such file')) {
      return new ValidationError(
        this.translateCliError(error.message, context),
        { originalError: error, context }
      );
    }

    if (errorMessage.includes('eacces') || errorMessage.includes('permission denied')) {
      return new SecurityError(
        this.translateCliError(error.message, context),
        { originalError: error, context }
      );
    }

    // Network/timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      return new ExecutionError(
        'Operation timed out. Try reducing search scope or increasing timeout.',
        { originalError: error, context }
      );
    }

    // Binary execution errors
    if (errorMessage.includes('spawn') || errorMessage.includes('enotdir')) {
      return new BinaryError(
        'Failed to execute ast-grep binary. Check installation and permissions.',
        { originalError: error, context }
      );
    }

    // Pattern/syntax errors
    if (errorMessage.includes('parse') || errorMessage.includes('syntax')) {
      return new ValidationError(
        this.translateCliError(error.message, context),
        { originalError: error, context }
      );
    }

    // Generic execution error
    return new ExecutionError(
      this.translateCliError(error.message, context),
      { originalError: error, context }
    );
  }

  static formatContextualError(error: AstGrepMCPError): string {
    let message = error.message;

    if (error.context) {
      // Add helpful context information
      if (error.context.workspace) {
        message += `\nWorkspace: ${error.context.workspace}`;
      }

      if (error.context.requestedPaths) {
        message += `\nPaths: ${error.context.requestedPaths.join(', ')}`;
      }

      if (error.context.pattern) {
        message += `\nPattern: ${error.context.pattern}`;
      }

      if (error.context.language) {
        message += `\nLanguage: ${error.context.language}`;
      }

      // Add comprehensive troubleshooting suggestions
      if (error instanceof ValidationError) {
        message += '\n\nTroubleshooting:';
        message += '\n- Use "code" parameter for inline search (most reliable)';
        message += '\n- For file search, use absolute paths (e.g., D:\\path\\to\\file.js)';
        message += '\n- Test patterns with simple examples first';
        message += '\n- Verify metavariables use UPPERCASE (e.g., $VAR, not $var)';
        message += '\n- Use $$$ for multi-node matching, not $$';
        message += '\n- Check language is correctly specified';
        message += '\n- Use ast-grep playground: https://ast-grep.github.io/playground';
      }

      if (error instanceof ExecutionError) {
        message += '\n\nExecution Tips:';
        message += '\n- Start with simple patterns before adding complexity';
        message += '\n- Use include/exclude patterns to limit scope';
        message += '\n- Increase timeout for large codebases';
        message += '\n- Check file permissions and workspace boundaries';
      }

      if (error instanceof SecurityError) {
        message += '\n\nSecurity Note: All operations are restricted to the detected workspace for safety.';
        message += '\n- Paths must be within workspace boundaries';
        message += '\n- No access to system directories or parent paths';
      }

      if (error instanceof BinaryError) {
        message += '\n\nBinary Installation:';
        message += '\n- Use --auto-install flag during MCP server setup';
        message += '\n- Set AST_GREP_BINARY_PATH environment variable';
        message += '\n- Install ast-grep manually: npm install -g @ast-grep/cli';
      }
    }

    return message;
  }
}