import { ValidationResult } from '../types/errors.js';
/**
 * Validates tool parameters against workspace boundaries and security policies.
 */
export declare class ParameterValidator {
    private workspaceRoot;
    private blockedPaths;
    /**
     * Persist the workspace root and populate security guardrails.
     */
    constructor(workspaceRoot: string);
    /**
     * Enumerate filesystem locations that tools must never modify.
     */
    private getBlockedPaths;
    /**
     * Validate search tool parameters and sanitize defaults.
     */
    validateSearchParams(params: any): ValidationResult;
    /**
     * Validate replace tool parameters and enforce workspace boundaries.
     */
    validateReplaceParams(params: any): ValidationResult;
    /**
     * Validate rewrite tool parameters including pattern and rewrite rules.
     */
    validateRewriteParams(params: any): ValidationResult;
    /**
     * Ensure provided paths stay within the workspace and are accessible.
     */
    private validatePaths;
    validateResourceLimits(paths: string[]): Promise<ValidationResult>;
    /**
     * Estimate file counts by walking directories with safeguards.
     */
    private countFilesRecursive;
    /**
     * Identify single and multi node metavariables within a pattern.
     */
    private extractMetavariables;
    /**
     * Validate that the ast-grep pattern is syntactically correct for the language.
     */
    private validateAstPattern;
    /**
     * Ensure replacement templates match the captured metavariables.
     */
    private validatePatternReplacementConsistency;
    /**
     * Determine if a pattern needs an explicit language selection.
     */
    private requiresLanguageHint;
    /**
     * Run language specific validation rules for advanced patterns.
     */
    private validateLanguageSpecificPattern;
    /**
     * Provide default exclude globs to avoid scanning generated content.
     */
    private getDefaultExcludes;
    /**
     * Infer a probable language from a pattern when none is specified.
     */
    private detectLanguageFromPattern;
    translateAstGrepError(errorMessage: string, context?: any): string;
    /**
     * Validate rule builder inputs before generating or executing ast-grep rules.
     */
    validateRuleBuilderParams(params: any): ValidationResult;
}
//# sourceMappingURL=validator.d.ts.map