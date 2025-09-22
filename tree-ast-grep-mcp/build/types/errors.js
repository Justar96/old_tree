// Custom error types for the MCP server
/**
 * Base error type that carries a machine readable code and optional context.
 */
export class AstGrepMCPError extends Error {
    context;
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = this.constructor.name;
    }
}
/**
 * Signals invalid parameters or user input that callers can correct.
 */
export class ValidationError extends AstGrepMCPError {
    code = 'VALIDATION_ERROR';
    recoverable = true;
}
/**
 * Indicates binary discovery or execution failures that require operator action.
 */
export class BinaryError extends AstGrepMCPError {
    code = 'BINARY_ERROR';
    recoverable = false;
}
/**
 * Raised when a request violates workspace security constraints.
 */
export class SecurityError extends AstGrepMCPError {
    code = 'SECURITY_ERROR';
    recoverable = false;
}
export class TimeoutError extends AstGrepMCPError {
    code = 'TIMEOUT_ERROR';
    recoverable = true;
}
export class FileSystemError extends AstGrepMCPError {
    code = 'FILESYSTEM_ERROR';
    recoverable = true;
}
/**
 * Represents ast-grep runtime failures that may be transient or recoverable.
 */
export class ExecutionError extends AstGrepMCPError {
    code = 'EXECUTION_ERROR';
    recoverable = true;
}
//# sourceMappingURL=errors.js.map