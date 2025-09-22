import { WorkspaceManager } from '../core/workspace-manager.js';
import { ScanResult, RunRuleParams } from '../types/schemas.js';
import { ScanTool } from './scan.js';
export declare class RunRuleTool {
    private validator;
    private scanTool;
    private workspaceManager;
    constructor(workspaceManager: WorkspaceManager, scanTool: ScanTool);
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
                kind: {
                    type: string;
                    description: string;
                };
                insidePattern: {
                    type: string;
                    description: string;
                };
                hasPattern: {
                    type: string;
                    description: string;
                };
                notPattern: {
                    type: string;
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
                            notRegex: {
                                type: string;
                            };
                            equals: {
                                type: string;
                            };
                            includes: {
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
                format: {
                    type: string;
                    enum: string[];
                    default: string;
                };
                include: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                exclude: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                ruleIds: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                timeoutMs: {
                    type: string;
                    minimum: number;
                    maximum: number;
                };
                relativePaths: {
                    type: string;
                    default: boolean;
                };
                jsonStyle: {
                    type: string;
                    enum: string[];
                    default: string;
                };
                follow: {
                    type: string;
                    default: boolean;
                };
                threads: {
                    type: string;
                    minimum: number;
                    maximum: number;
                };
                noIgnore: {
                    type: string;
                    default: boolean;
                };
                ignorePath: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                root: {
                    type: string;
                };
                workdir: {
                    type: string;
                };
                saveTo: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
    };
    execute(params: RunRuleParams): Promise<{
        yaml: string;
        scan: ScanResult;
        savedPath?: string;
    }>;
    private buildYaml;
}
//# sourceMappingURL=rule-builder.d.ts.map