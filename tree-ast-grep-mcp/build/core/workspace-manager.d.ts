export interface WorkspaceConfig {
    root: string;
    allowedPaths: string[];
    blockedPaths: string[];
    maxDepth: number;
}
/**
 * Detects and manages workspace boundaries used by MCP tools.
 */
export declare class WorkspaceManager {
    private config;
    /**
     * Build workspace configuration from an optional explicit root.
     */
    constructor(explicitRoot?: string);
    /**
     * Determine the effective workspace root and allowed path boundaries.
     */
    private detectWorkspace;
    private autoDetectWorkspaceRoot;
    private validateWorkspaceRoot;
    private getBlockedPaths;
    getConfig(): WorkspaceConfig;
    /**
     * Expose the root directory used for workspace relative operations.
     */
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