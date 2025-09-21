import { InstallationOptions } from '../types/errors.js';
export declare class AstGrepBinaryManager {
    private binaryPath;
    private isInitialized;
    private options;
    constructor(options?: InstallationOptions);
    initialize(): Promise<void>;
    private useCustomBinary;
    private useSystemBinary;
    private installPlatformBinary;
    private findBinaryInPath;
    private testBinary;
    private fileExists;
    private getBinaryName;
    private downloadBinary;
    private downloadWithRetry;
    private downloadFile;
    private extractBinary;
    private findFilesRecursively;
    private cleanup;
    getBinaryPath(): string | null;
    executeAstGrep(args: string[], options?: {
        cwd?: string;
        timeout?: number;
    }): Promise<{
        stdout: string;
        stderr: string;
    }>;
}
//# sourceMappingURL=binary-manager.d.ts.map