export declare abstract class AstGrepMCPError extends Error {
    readonly context?: any | undefined;
    abstract readonly code: string;
    abstract readonly recoverable: boolean;
    constructor(message: string, context?: any | undefined);
}
export declare class ValidationError extends AstGrepMCPError {
    readonly code = "VALIDATION_ERROR";
    readonly recoverable = true;
}
export declare class BinaryError extends AstGrepMCPError {
    readonly code = "BINARY_ERROR";
    readonly recoverable = false;
}
export declare class SecurityError extends AstGrepMCPError {
    readonly code = "SECURITY_ERROR";
    readonly recoverable = false;
}
export declare class TimeoutError extends AstGrepMCPError {
    readonly code = "TIMEOUT_ERROR";
    readonly recoverable = true;
}
export declare class FileSystemError extends AstGrepMCPError {
    readonly code = "FILESYSTEM_ERROR";
    readonly recoverable = true;
}
export declare class ExecutionError extends AstGrepMCPError {
    readonly code = "EXECUTION_ERROR";
    readonly recoverable = true;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    sanitized?: any;
}
export interface InstallationOptions {
    platform?: 'win32' | 'darwin' | 'linux' | 'auto';
    useSystem?: boolean;
    autoInstall?: boolean;
    cacheDir?: string;
    customBinaryPath?: string;
}
//# sourceMappingURL=errors.d.ts.map