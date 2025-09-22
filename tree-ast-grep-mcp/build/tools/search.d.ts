import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
/**
 * Direct search tool that calls ast-grep run with minimal overhead
 */
export declare class SearchTool {
    private binaryManager;
    private workspaceManager;
    constructor(binaryManager: AstGrepBinaryManager, workspaceManager: WorkspaceManager);
    execute(params: any): Promise<any>;
    private parseResults;
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
                context: {
                    type: string;
                    default: number;
                    description: string;
                };
                maxMatches: {
                    type: string;
                    default: number;
                    description: string;
                };
                timeoutMs: {
                    type: string;
                    default: number;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=search.d.ts.map