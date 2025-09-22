import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
/**
 * Rule builder that generates YAML and runs ast-grep scan
 */
export declare class ScanTool {
    private workspaceManager;
    private binaryManager;
    constructor(workspaceManager: WorkspaceManager, binaryManager: AstGrepBinaryManager);
    execute(params: any): Promise<any>;
    private buildYaml;
    private parseFindings;
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                id: {
                    type: string;
                    description: string;
                };
                language: {
                    type: string;
                    description: string;
                };
                pattern: {
                    type: string;
                    description: string;
                };
                message: {
                    type: string;
                    description: string;
                };
                severity: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
                };
                where: {
                    type: string;
                    items: {
                        type: string;
                        properties: {
                            metavariable: {
                                type: string;
                            };
                            regex: {
                                type: string;
                            };
                            equals: {
                                type: string;
                            };
                        };
                        required: string[];
                    };
                    description: string;
                };
                fix: {
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
//# sourceMappingURL=scan.d.ts.map