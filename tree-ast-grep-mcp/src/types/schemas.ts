import { z } from 'zod';

/**
 * Schema describing the workspace configuration persisted on disk.
 */
export const WorkspaceConfigSchema = z.object({
  root: z.string(),
  allowedPaths: z.array(z.string()).optional(),
  blockedPaths: z.array(z.string()).optional(),
  maxDepth: z.number().min(1).max(20).default(10),
});

/**
 * Schema for ast_search tool input parameters.
 */
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

export type SearchParams = z.infer<typeof SearchParamsSchema>;

/**
 * Schema for ast_replace tool input parameters.
 */
export const ReplaceParamsSchema = z.object({
  pattern: z.string().min(1, 'Pattern cannot be empty'),
  replacement: z.string(),
  paths: z.array(z.string()).optional(),
  language: z.string().optional(),
  dryRun: z.boolean().default(true),
  interactive: z.boolean().default(false),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  // Additional options aligned with ast_search tool signature
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

export type ReplaceParams = z.infer<typeof ReplaceParamsSchema>;

/**
 * Schema for ast_scan tool input parameters.
 */
export const ScanParamsSchema = z.object({
  rules: z.string().optional(),
  paths: z.array(z.string()).optional(),
  format: z.enum(['json', 'text', 'github']).default('json'),
  severity: z.enum(['error', 'warning', 'info', 'all']).default('all'),
  ruleIds: z.array(z.string()).optional(),
  include: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  // Additional options matching ast_search and ast_replace capabilities
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

export type ScanParams = z.infer<typeof ScanParamsSchema>;

/**
 * Schema for ast_rewrite tool input parameters.
 */
export const RewriteParamsSchema = z.object({
  rules: z.string().min(1, 'Rules cannot be empty'),
  paths: z.array(z.string()).optional(),
  language: z.string().optional(),
  dryRun: z.boolean().default(true),
});

export type RewriteParams = z.infer<typeof RewriteParamsSchema>;

/**
 * Structured result types emitted by ast_search.
 */
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

export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Structured result types emitted by ast_replace.
 */
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

export type ReplaceResult = z.infer<typeof ReplaceResultSchema>;

/**
 * Structured result types emitted by ast_scan.
 */
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

export type ScanResult = z.infer<typeof ScanResultSchema>;

/**
 * Schema for ast_run_rule rule construction parameters.
 */
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

export type RuleBuilderParams = z.infer<typeof RuleBuilderParamsSchema>;

export const RuleBuilderResultSchema = z.object({
  yaml: z.string(),
  summary: z.string(),
});

export type RuleBuilderResult = z.infer<typeof RuleBuilderResultSchema>;

/**
 * Combined schema merging rule builder and scan parameters for ast_run_rule.
 */
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

export type RunRuleParams = z.infer<typeof RunRuleParamsSchema>;



