import { BaseTool } from '../core/tool-base.js';
import { ScanResult, RunRuleParams } from '../types/schemas.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { AstGrepBinaryManager } from '../core/binary-manager.js';
export declare class RunRuleTool extends BaseTool {
    private patternValidator;
    constructor(workspaceManager: WorkspaceManager, binaryManager: AstGrepBinaryManager);
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
                                description: string;
                            };
                            regex: {
                                type: string;
                                description: string;
                            };
                            notRegex: {
                                type: string;
                                description: string;
                            };
                            equals: {
                                type: string;
                                description: string;
                            };
                            includes: {
                                type: string;
                                description: string;
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
                ruleIds: {
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
    /**
     * Execute the generated YAML rule directly using ast-grep
     */
    private executeRule;
    /**
     * Build ast-grep scan command arguments
     */
    private buildScanArgs;
    /**
     * Parse ast-grep scan results into ScanResult format
     */
    private parseScanResults;
    /**
     * Parse a single finding from ast-grep output
     */
    private parseSingleFinding;
    /**
     * Extract files scanned count from stderr output
     */
    private extractFilesScanned;
    /**
     * Count files in given paths for file scanning metrics
     */
    private countFilesInPaths;
}
//# sourceMappingURL=rule-builder.d.ts.map