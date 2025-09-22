import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ReplaceParams, ReplaceResult } from '../types/schemas.js';
/**
 * Performs ast-grep replacements and writes changes within the workspace.
 */
export declare class ReplaceTool {
    private binaryManager;
    private validator;
    private workspaceManager;
    /**
     * Initialize the tool with binary execution and workspace services.
     */
    constructor(binaryManager: AstGrepBinaryManager, workspaceManager: WorkspaceManager);
    /**
     * Run ast-grep replace with validated parameters and return change metadata.
     */
    execute(params: ReplaceParams): Promise<ReplaceResult>;
    private createBackups;
    private buildReplaceArgs;
    private parseReplaceResults;
    private parseDiffOutput;
    /**
     * Describe the MCP schema for the replace tool.
     */
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                pattern: {
                    type: string;
                    description: string;
                };
                replacement: {
                    type: string;
                    description: string;
                };
                code: {
                    type: string;
                    description: string;
                };
                paths: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                language: {
                    type: string;
                    description: string;
                };
                dryRun: {
                    type: string;
                    default: boolean;
                    description: string;
                };
                interactive: {
                    type: string;
                    default: boolean;
                    description: string;
                };
                include: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                exclude: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                timeoutMs: {
                    type: string;
                    minimum: number;
                    maximum: number;
                    description: string;
                };
                relativePaths: {
                    type: string;
                    default: boolean;
                    description: string;
                };
                follow: {
                    type: string;
                    default: boolean;
                    description: string;
                };
                threads: {
                    type: string;
                    minimum: number;
                    maximum: number;
                    description: string;
                };
                noIgnore: {
                    type: string;
                    default: boolean;
                    description: string;
                };
                ignorePath: {
                    type: string;
                    items: {
                        type: string;
                    };
                    description: string;
                };
                root: {
                    type: string;
                    description: string;
                };
                workdir: {
                    type: string;
                    description: string;
                };
                stdinFilepath: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=replace.d.ts.map