export interface WorkspaceConfig {
    root: string;
    allowedPaths: string[];
    blockedPaths: string[];
    maxDepth: number;
}
export declare class WorkspaceManager {
    private config;
    constructor(explicitRoot?: string);
    private detectWorkspace;
    private autoDetectWorkspaceRoot;
    private validateWorkspaceRoot;
    private getBlockedPaths;
    getConfig(): WorkspaceConfig;
    getWorkspaceRoot(): string;
    validatePath(inputPath: string): {
        valid: boolean;
        resolvedPath: string;
        error?: string;
    };
    validatePaths(inputPaths: string[]): {
        valid: boolean;
        resolvedPaths: string[];
        errors: string[];
    };
    getWorkspaceFiles(options?: {
        includePatterns?: string[];
        excludePatterns?: string[];
        maxFiles?: number;
    }): Promise<string[]>;
    private countFilesRecursive;
}
//# sourceMappingURL=workspace-manager.d.ts.map