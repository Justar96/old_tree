import { AstGrepBinaryManager } from '../core/binary-manager.js';
import { WorkspaceManager } from '../core/workspace-manager.js';
import { ScanParams, ScanResult } from '../types/schemas.js';
export declare class ScanTool {
    private binaryManager;
    private validator;
    private workspaceManager;
    constructor(binaryManager: AstGrepBinaryManager, workspaceManager: WorkspaceManager);
    execute(params: ScanParams): Promise<ScanResult>;
    private scanWithRules;
    private scanWithoutRules;
    private createTemporaryRulesFile;
    private buildScanArgs;
    private parseScanResults;
    private parseSingleFinding;
    private extractFilesScanned;
    static getSchema(): {
        name: string;
        description: string;
        inputSchema: {
            type: string;
            properties: {
                rules: {
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
                severity: {
                    type: string;
                    enum: string[];
                    default: string;
                    description: string;
                };
                ruleIds: {
                    type: string;
                    items: {
                        type: string;
                    };
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
                jsonStyle: {
                    type: string;
                    enum: string[];
                    default: string;
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
            };
        };
    };
}
//# sourceMappingURL=scan.d.ts.map