import { ValidationResult } from '../types/errors.js';
export declare class ParameterValidator {
    private workspaceRoot;
    private blockedPaths;
    constructor(workspaceRoot: string);
    private getBlockedPaths;
    validateSearchParams(params: any): ValidationResult;
    validateReplaceParams(params: any): ValidationResult;
    validateScanParams(params: any): ValidationResult;
    validateRewriteParams(params: any): ValidationResult;
    private validatePaths;
    validateResourceLimits(paths: string[]): Promise<ValidationResult>;
    private countFilesRecursive;
    private extractMetavariables;
    private validateAstPattern;
    private validatePatternReplacementConsistency;
    private requiresLanguageHint;
    private validateLanguageSpecificPattern;
    private getDefaultExcludes;
    private detectLanguageFromPattern;
    translateAstGrepError(errorMessage: string, context?: any): string;
    validateRuleBuilderParams(params: any): ValidationResult;
}
//# sourceMappingURL=validator.d.ts.map