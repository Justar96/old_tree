// Custom error types for the MCP server
export class AstGrepMCPError extends Error {
    context;
    constructor(message, context) {
        super(message);
        this.context = context;
        this.name = this.constructor.name;
    }
}
export class ValidationError extends AstGrepMCPError {
    code = 'VALIDATION_ERROR';
    recoverable = true;
}
export class BinaryError extends AstGrepMCPError {
    code = 'BINARY_ERROR';
    recoverable = false;
}
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
export class ExecutionError extends AstGrepMCPError {
    code = 'EXECUTION_ERROR';
    recoverable = true;
}
//# sourceMappingURL=errors.js.map