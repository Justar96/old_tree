import { InstallationOptions } from '../types/errors.js';
/**
 * Manages ast-grep binary discovery, installation, validation, and execution.
 */
export declare class AstGrepBinaryManager {
    private binaryPath;
    private isInitialized;
    private options;
    /**
     * Create a manager with optional installation directives.
     */
    constructor(options?: InstallationOptions);
    /**
     * Resolve and prepare an ast-grep binary for subsequent tool execution.
     */
    initialize(): Promise<void>;
    /**
     * Validate and register a caller supplied binary path without downloading.
     */
    private useCustomBinary;
    /**
     * Locate ast-grep on PATH and ensure it can be executed.
     */
    private useSystemBinary;
    /**
     * Download and cache a platform specific ast-grep binary when requested.
     */
    private installPlatformBinary;
    /**
     * Search the environment PATH for an ast-grep executable.
     */
    private findBinaryInPath;
    /**
     * Run --version against the provided binary to confirm it is usable.
     */
    private testBinary;
    /**
     * Determine whether a file exists without throwing on access errors.
     */
    private fileExists;
    /**
     * Build the expected ast-grep file name for the given platform and architecture.
     */
    private getBinaryName;
    /**
     * Download, extract, and validate a platform specific ast-grep binary.
     */
    private downloadBinary;
    /**
     * Download a file with retry logic and exponential backoff.
     */
    private downloadWithRetry;
    /**
     * Stream a remote file to disk using the built in fetch implementation.
     */
    private downloadFile;
    /**
     * Extract the ast-grep binary from an archive and stage the executable.
     */
    private extractBinary;
    /**
     * Walk a directory tree and collect file paths for archive extraction.
     */
    private findFilesRecursively;
    /**
     * Remove temporary files created during download or extraction.
     */
    private cleanup;
    /**
     * Return the resolved ast-grep binary path if initialization succeeded.
     */
    getBinaryPath(): string | null;
    /**
     * Execute ast-grep with the provided arguments and optional stdin payload.
     */
    executeAstGrep(args: string[], options?: {
        cwd?: string;
        timeout?: number;
        stdin?: string;
    }): Promise<{
        stdout: string;
        stderr: string;
    }>;
    /**
     * Determine the appropriate command wrapper for invoking the binary on each platform.
     */
    private getExecutionCommand;
}
//# sourceMappingURL=binary-manager.d.ts.map