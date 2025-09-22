/**
 * Base error type that carries a machine readable code and optional context.
 */
export declare abstract class AstGrepMCPError extends Error {
    readonly context?: any | undefined;
    abstract readonly code: string;
    abstract readonly recoverable: boolean;
    constructor(message: string, context?: any | undefined);
}
/**
 * Signals invalid parameters or user input that callers can correct.
 */
export declare class ValidationError extends AstGrepMCPError {
    readonly code = "VALIDATION_ERROR";
    readonly recoverable = true;
}
/**
 * Indicates binary discovery or execution failures that require operator action.
 */
export declare class BinaryError extends AstGrepMCPError {
    readonly code = "BINARY_ERROR";
    readonly recoverable = false;
}
/**
 * Raised when a request violates workspace security constraints.
 */
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
/**
 * Represents ast-grep runtime failures that may be transient or recoverable.
 */
export declare class ExecutionError extends AstGrepMCPError {
    readonly code = "EXECUTION_ERROR";
    readonly recoverable = true;
}
export interface ValidationDiagnostics {
    patternType?: string;
    metavariables?: {
        single: string[];
        multi: string[];
        problematic: string[];
        reliable: string[];
    };
    languageCompatibility?: string[];
    complexity?: 'simple' | 'moderate' | 'complex' | 'very_complex' | 'nested';
    reliabilityScore?: number;
    patternReliabilityScore?: number;
    enhancedValidationApplied?: boolean;
    issues?: string[];
    warnings?: string[];
    patterns?: any;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    sanitized?: any;
    diagnostics?: ValidationDiagnostics;
}
export interface InstallationOptions {
    platform?: 'win32' | 'darwin' | 'linux' | 'auto';
    useSystem?: boolean;
    autoInstall?: boolean;
    cacheDir?: string;
    customBinaryPath?: string;
}
//# sourceMappingURL=errors.d.ts.map