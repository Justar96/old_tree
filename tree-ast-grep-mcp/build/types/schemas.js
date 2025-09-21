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
    text: z.string(),
    context: z.object({
        before: z.array(z.string()),
        after: z.array(z.string()),
    }),
    matchedNode: z.string(),
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
    fix: z.string().optional(),
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
//# sourceMappingURL=schemas.js.map