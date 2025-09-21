import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { SearchParams, SearchResult } from '../types/schemas.js';
export declare class SearchTool {
    private binaryManager;
    private validator;
    private workspaceManager;
    constructor(binaryManager: AstGrepBinaryManager, workspaceManager: WorkspaceManager);
    execute(params: SearchParams): Promise<SearchResult>;
    private buildSearchArgs;
    private parseSearchResults;
    private parseSingleMatch;
    private extractFilesScanned;
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
                    minimum: number;
                    maximum: number;
                    default: number;
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
                maxMatches: {
                    type: string;
                    minimum: number;
                    maximum: number;
                    default: number;
                    description: string;
                };
            };
            required: string[];
        };
    };
}
//# sourceMappingURL=search.d.ts.map