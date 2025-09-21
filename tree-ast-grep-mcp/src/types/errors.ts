// Custom error types for the MCP server
export abstract class AstGrepMCPError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AstGrepMCPError {
  readonly code = 'VALIDATION_ERROR';
  readonly recoverable = true;
}

export class BinaryError extends AstGrepMCPError {
  readonly code = 'BINARY_ERROR';
  readonly recoverable = false;
}

export class SecurityError extends AstGrepMCPError {
  readonly code = 'SECURITY_ERROR';
  readonly recoverable = false;
}

export class TimeoutError extends AstGrepMCPError {
  readonly code = 'TIMEOUT_ERROR';
  readonly recoverable = true;
}

export class FileSystemError extends AstGrepMCPError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly recoverable = true;
}

export class ExecutionError extends AstGrepMCPError {
  readonly code = 'EXECUTION_ERROR';
  readonly recoverable = true;
}

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: any;
}

// Installation options for binary management
export interface InstallationOptions {
  platform?: 'win32' | 'darwin' | 'linux' | 'auto';
  useSystem?: boolean;
  autoInstall?: boolean;
  cacheDir?: string;
  customBinaryPath?: string;
}