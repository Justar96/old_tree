import { z } from 'zod';
// Base workspace configuration
export const WorkspaceConfigSchema = z.object({
    root: z.string(),
    allowedPaths: z.array(z.string()).optional(),
    blockedPaths: z.array(z.string()).optional(),
    maxDepth: z.number().min(1).max(20).default(10),
});
// Search tool parameters
export const SearchParamsSchema = z.object({
    pattern: z.string().min(1, 'Pattern cannot be empty'),
    paths: z.array(z.string()).optional(),
    language: z.string().optional(),
    context: z.number().min(0).max(10).default(3),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    maxMatches: z.number().min(1).max(10000).default(100),
    timeoutMs: z.number().min(1000).max(180000).optional(),
    relativePaths: z.boolean().default(false).optional(),
    perFileMatchLimit: z.number().min(1).max(1000).optional(),
    noIgnore: z.boolean().default(false).optional(),
    ignorePath: z.array(z.string()).optional(),
    root: z.string().optional(),
    workdir: z.string().optional(),
    code: z.string().optional(),
    stdinFilepath: z.string().optional(),
    jsonStyle: z.enum(['stream', 'pretty', 'compact']).default('stream').optional(),
    follow: z.boolean().default(false).optional(),
    threads: z.number().min(1).max(64).optional(),
});
// Replace tool parameters
export const ReplaceParamsSchema = z.object({
    pattern: z.string().min(1, 'Pattern cannot be empty'),
    replacement: z.string(),
    paths: z.array(z.string()).optional(),
    language: z.string().optional(),
    dryRun: z.boolean().default(true),
    interactive: z.boolean().default(false),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    // New options aligned with ast_search
    timeoutMs: z.number().min(1000).max(180000).optional(),
    relativePaths: z.boolean().default(false).optional(),
    jsonStyle: z.enum(['stream', 'pretty', 'compact']).default('stream').optional(),
    follow: z.boolean().default(false).optional(),
    threads: z.number().min(1).max(64).optional(),
    noIgnore: z.boolean().default(false).optional(),
    ignorePath: z.array(z.string()).optional(),
    root: z.string().optional(),
    workdir: z.string().optional(),
    code: z.string().optional(),
    stdinFilepath: z.string().optional(),
});
// Scan tool parameters
export const ScanParamsSchema = z.object({
    rules: z.string().optional(),
    paths: z.array(z.string()).optional(),
    format: z.enum(['json', 'text', 'github']).default('json'),
    severity: z.enum(['error', 'warning', 'info', 'all']).default('all'),
    ruleIds: z.array(z.string()).optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    // Advanced options (parity with search/replace)
    timeoutMs: z.number().min(1000).max(180000).optional(),
    relativePaths: z.boolean().default(false).optional(),
    jsonStyle: z.enum(['stream', 'pretty', 'compact']).default('stream').optional(),
    follow: z.boolean().default(false).optional(),
    threads: z.number().min(1).max(64).optional(),
    noIgnore: z.boolean().default(false).optional(),
    ignorePath: z.array(z.string()).optional(),
    root: z.string().optional(),
    workdir: z.string().optional(),
});
// Rewrite tool parameters
export const RewriteParamsSchema = z.object({
    rules: z.string().min(1, 'Rules cannot be empty'),
    paths: z.array(z.string()).optional(),
    language: z.string().optional(),
    dryRun: z.boolean().default(true),
});
// Search result types
export const SearchMatchSchema = z.object({
    file: z.string(),
    line: z.number(),
    column: z.number(),
    endLine: z.number().optional(),
    endColumn: z.number().optional(),
    text: z.string(),
    context: z.object({
        before: z.array(z.string()),
        after: z.array(z.string()),
    }),
    matchedNode: z.string(),
    captures: z.array(z.object({
        name: z.string(),
        text: z.string().optional(),
        startLine: z.number().optional(),
        startColumn: z.number().optional(),
        endLine: z.number().optional(),
        endColumn: z.number().optional(),
    })).optional(),
});
export const SearchResultSchema = z.object({
    matches: z.array(SearchMatchSchema),
    summary: z.object({
        totalMatches: z.number(),
        filesScanned: z.number(),
        language: z.string().optional(),
        executionTime: z.number(),
    }),
});
// Replace result types
export const ReplaceChangeSchema = z.object({
    file: z.string(),
    matches: z.number(),
    preview: z.string().optional(),
    applied: z.boolean(),
    captures: z.array(z.object({
        name: z.string(),
        text: z.string().optional(),
        startLine: z.number().optional(),
        startColumn: z.number().optional(),
        endLine: z.number().optional(),
        endColumn: z.number().optional(),
    })).optional(),
});
export const ReplaceResultSchema = z.object({
    changes: z.array(ReplaceChangeSchema),
    summary: z.object({
        totalChanges: z.number(),
        filesModified: z.number(),
        dryRun: z.boolean(),
    }),
});
// Scan result types
export const ScanFindingSchema = z.object({
    ruleId: z.string(),
    severity: z.string(),
    message: z.string(),
    file: z.string(),
    line: z.number(),
    column: z.number(),
    endLine: z.number().optional(),
    endColumn: z.number().optional(),
    fix: z.string().optional(),
    captures: z.array(z.object({
        name: z.string(),
        text: z.string().optional(),
        startLine: z.number().optional(),
        startColumn: z.number().optional(),
        endLine: z.number().optional(),
        endColumn: z.number().optional(),
    })).optional(),
});
export const ScanResultSchema = z.object({
    findings: z.array(ScanFindingSchema),
    summary: z.object({
        totalFindings: z.number(),
        errors: z.number(),
        warnings: z.number(),
        filesScanned: z.number(),
    }),
});
// Rule builder parameters
export const RuleBuilderWhereClauseSchema = z.object({
    metavariable: z.string(),
    regex: z.string().optional(),
    notRegex: z.string().optional(),
    equals: z.string().optional(),
    includes: z.string().optional(),
});
export const RuleBuilderParamsSchema = z.object({
    id: z.string().min(1),
    language: z.string().min(1),
    pattern: z.string().min(1),
    message: z.string().optional(),
    severity: z.enum(['error', 'warning', 'info']).default('warning').optional(),
    kind: z.string().optional(),
    insidePattern: z.string().optional(),
    hasPattern: z.string().optional(),
    notPattern: z.string().optional(),
    where: z.array(RuleBuilderWhereClauseSchema).optional(),
    fix: z.string().optional(),
});
export const RuleBuilderResultSchema = z.object({
    yaml: z.string(),
    summary: z.string(),
});
// Combined params for ast_run_rule (rule + scan params)
export const RunRuleParamsSchema = RuleBuilderParamsSchema.extend({
    // Scan-specific fields
    paths: z.array(z.string()).optional(),
    format: z.enum(['json', 'text', 'github']).default('json').optional(),
    severity: z.enum(['error', 'warning', 'info', 'all']).default('all').optional(),
    ruleIds: z.array(z.string()).optional(),
    include: z.array(z.string()).optional(),
    exclude: z.array(z.string()).optional(),
    timeoutMs: z.number().min(1000).max(180000).optional(),
    relativePaths: z.boolean().default(false).optional(),
    jsonStyle: z.enum(['stream', 'pretty', 'compact']).default('stream').optional(),
    follow: z.boolean().default(false).optional(),
    threads: z.number().min(1).max(64).optional(),
    noIgnore: z.boolean().default(false).optional(),
    ignorePath: z.array(z.string()).optional(),
    root: z.string().optional(),
    workdir: z.string().optional(),
    saveTo: z.string().optional(),
});
//# sourceMappingURL=schemas.js.map