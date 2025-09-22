import { z } from 'zod';
/**
 * Schema describing the workspace configuration persisted on disk.
 */
export declare const WorkspaceConfigSchema: z.ZodObject<{
    root: z.ZodString;
    allowedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    blockedPaths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxDepth: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    root: string;
    maxDepth: number;
    allowedPaths?: string[] | undefined;
    blockedPaths?: string[] | undefined;
}, {
    root: string;
    allowedPaths?: string[] | undefined;
    blockedPaths?: string[] | undefined;
    maxDepth?: number | undefined;
}>;
/**
 * Schema for ast_search tool input parameters.
 */
export declare const SearchParamsSchema: z.ZodObject<{
    pattern: z.ZodString;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    language: z.ZodOptional<z.ZodString>;
    context: z.ZodDefault<z.ZodNumber>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxMatches: z.ZodDefault<z.ZodNumber>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    relativePaths: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    perFileMatchLimit: z.ZodOptional<z.ZodNumber>;
    noIgnore: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    ignorePath: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    root: z.ZodOptional<z.ZodString>;
    workdir: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    stdinFilepath: z.ZodOptional<z.ZodString>;
    jsonStyle: z.ZodOptional<z.ZodDefault<z.ZodEnum<["stream", "pretty", "compact"]>>>;
    follow: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    threads: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    context: number;
    maxMatches: number;
    root?: string | undefined;
    code?: string | undefined;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    perFileMatchLimit?: number | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    stdinFilepath?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
}, {
    pattern: string;
    root?: string | undefined;
    code?: string | undefined;
    paths?: string[] | undefined;
    language?: string | undefined;
    context?: number | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    maxMatches?: number | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    perFileMatchLimit?: number | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    stdinFilepath?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
}>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
/**
 * Schema for ast_replace tool input parameters.
 */
export declare const ReplaceParamsSchema: z.ZodObject<{
    pattern: z.ZodString;
    replacement: z.ZodString;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    language: z.ZodOptional<z.ZodString>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
    interactive: z.ZodDefault<z.ZodBoolean>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    relativePaths: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    jsonStyle: z.ZodOptional<z.ZodDefault<z.ZodEnum<["stream", "pretty", "compact"]>>>;
    follow: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    threads: z.ZodOptional<z.ZodNumber>;
    noIgnore: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    ignorePath: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    root: z.ZodOptional<z.ZodString>;
    workdir: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    stdinFilepath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    replacement: string;
    dryRun: boolean;
    interactive: boolean;
    root?: string | undefined;
    code?: string | undefined;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    stdinFilepath?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
}, {
    pattern: string;
    replacement: string;
    root?: string | undefined;
    code?: string | undefined;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    stdinFilepath?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
    dryRun?: boolean | undefined;
    interactive?: boolean | undefined;
}>;
export type ReplaceParams = z.infer<typeof ReplaceParamsSchema>;
/**
 * Schema for ast_rewrite tool input parameters.
 */
export declare const RewriteParamsSchema: z.ZodObject<{
    rules: z.ZodString;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    language: z.ZodOptional<z.ZodString>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    dryRun: boolean;
    rules: string;
    paths?: string[] | undefined;
    language?: string | undefined;
}, {
    rules: string;
    paths?: string[] | undefined;
    language?: string | undefined;
    dryRun?: boolean | undefined;
}>;
export type RewriteParams = z.infer<typeof RewriteParamsSchema>;
/**
 * Structured result types emitted by ast_search.
 */
export declare const SearchMatchSchema: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
    endLine: z.ZodOptional<z.ZodNumber>;
    endColumn: z.ZodOptional<z.ZodNumber>;
    text: z.ZodString;
    context: z.ZodObject<{
        before: z.ZodArray<z.ZodString, "many">;
        after: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        before: string[];
        after: string[];
    }, {
        before: string[];
        after: string[];
    }>;
    matchedNode: z.ZodString;
    captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
        startLine: z.ZodOptional<z.ZodNumber>;
        startColumn: z.ZodOptional<z.ZodNumber>;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    context: {
        before: string[];
        after: string[];
    };
    file: string;
    line: number;
    column: number;
    text: string;
    matchedNode: string;
    endLine?: number | undefined;
    endColumn?: number | undefined;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
}, {
    context: {
        before: string[];
        after: string[];
    };
    file: string;
    line: number;
    column: number;
    text: string;
    matchedNode: string;
    endLine?: number | undefined;
    endColumn?: number | undefined;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
}>;
export declare const SearchResultSchema: z.ZodObject<{
    matches: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        column: z.ZodNumber;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
        text: z.ZodString;
        context: z.ZodObject<{
            before: z.ZodArray<z.ZodString, "many">;
            after: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            before: string[];
            after: string[];
        }, {
            before: string[];
            after: string[];
        }>;
        matchedNode: z.ZodString;
        captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            startLine: z.ZodOptional<z.ZodNumber>;
            startColumn: z.ZodOptional<z.ZodNumber>;
            endLine: z.ZodOptional<z.ZodNumber>;
            endColumn: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        context: {
            before: string[];
            after: string[];
        };
        file: string;
        line: number;
        column: number;
        text: string;
        matchedNode: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
    }, {
        context: {
            before: string[];
            after: string[];
        };
        file: string;
        line: number;
        column: number;
        text: string;
        matchedNode: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalMatches: z.ZodNumber;
        filesScanned: z.ZodNumber;
        language: z.ZodOptional<z.ZodString>;
        executionTime: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalMatches: number;
        filesScanned: number;
        executionTime: number;
        language?: string | undefined;
    }, {
        totalMatches: number;
        filesScanned: number;
        executionTime: number;
        language?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    matches: {
        context: {
            before: string[];
            after: string[];
        };
        file: string;
        line: number;
        column: number;
        text: string;
        matchedNode: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
    }[];
    summary: {
        totalMatches: number;
        filesScanned: number;
        executionTime: number;
        language?: string | undefined;
    };
}, {
    matches: {
        context: {
            before: string[];
            after: string[];
        };
        file: string;
        line: number;
        column: number;
        text: string;
        matchedNode: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
    }[];
    summary: {
        totalMatches: number;
        filesScanned: number;
        executionTime: number;
        language?: string | undefined;
    };
}>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
/**
 * Structured result types emitted by ast_replace.
 */
export declare const ReplaceChangeSchema: z.ZodObject<{
    file: z.ZodString;
    matches: z.ZodNumber;
    preview: z.ZodOptional<z.ZodString>;
    applied: z.ZodBoolean;
    captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
        startLine: z.ZodOptional<z.ZodNumber>;
        startColumn: z.ZodOptional<z.ZodNumber>;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    file: string;
    matches: number;
    applied: boolean;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
    preview?: string | undefined;
}, {
    file: string;
    matches: number;
    applied: boolean;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
    preview?: string | undefined;
}>;
export declare const ReplaceResultSchema: z.ZodObject<{
    changes: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        matches: z.ZodNumber;
        preview: z.ZodOptional<z.ZodString>;
        applied: z.ZodBoolean;
        captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            startLine: z.ZodOptional<z.ZodNumber>;
            startColumn: z.ZodOptional<z.ZodNumber>;
            endLine: z.ZodOptional<z.ZodNumber>;
            endColumn: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        file: string;
        matches: number;
        applied: boolean;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        preview?: string | undefined;
    }, {
        file: string;
        matches: number;
        applied: boolean;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        preview?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalChanges: z.ZodNumber;
        filesModified: z.ZodNumber;
        dryRun: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        dryRun: boolean;
        totalChanges: number;
        filesModified: number;
    }, {
        dryRun: boolean;
        totalChanges: number;
        filesModified: number;
    }>;
}, "strip", z.ZodTypeAny, {
    summary: {
        dryRun: boolean;
        totalChanges: number;
        filesModified: number;
    };
    changes: {
        file: string;
        matches: number;
        applied: boolean;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        preview?: string | undefined;
    }[];
}, {
    summary: {
        dryRun: boolean;
        totalChanges: number;
        filesModified: number;
    };
    changes: {
        file: string;
        matches: number;
        applied: boolean;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        preview?: string | undefined;
    }[];
}>;
export type ReplaceResult = z.infer<typeof ReplaceResultSchema>;
/**
 * Structured result types for rule scanning operations.
 */
export declare const ScanFindingSchema: z.ZodObject<{
    ruleId: z.ZodString;
    severity: z.ZodString;
    message: z.ZodString;
    file: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
    endLine: z.ZodOptional<z.ZodNumber>;
    endColumn: z.ZodOptional<z.ZodNumber>;
    fix: z.ZodOptional<z.ZodString>;
    captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        text: z.ZodOptional<z.ZodString>;
        startLine: z.ZodOptional<z.ZodNumber>;
        startColumn: z.ZodOptional<z.ZodNumber>;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }, {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    message: string;
    file: string;
    line: number;
    column: number;
    ruleId: string;
    severity: string;
    endLine?: number | undefined;
    endColumn?: number | undefined;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
    fix?: string | undefined;
}, {
    message: string;
    file: string;
    line: number;
    column: number;
    ruleId: string;
    severity: string;
    endLine?: number | undefined;
    endColumn?: number | undefined;
    captures?: {
        name: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        text?: string | undefined;
        startLine?: number | undefined;
        startColumn?: number | undefined;
    }[] | undefined;
    fix?: string | undefined;
}>;
export declare const ScanResultSchema: z.ZodObject<{
    findings: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        severity: z.ZodString;
        message: z.ZodString;
        file: z.ZodString;
        line: z.ZodNumber;
        column: z.ZodNumber;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
        fix: z.ZodOptional<z.ZodString>;
        captures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            text: z.ZodOptional<z.ZodString>;
            startLine: z.ZodOptional<z.ZodNumber>;
            startColumn: z.ZodOptional<z.ZodNumber>;
            endLine: z.ZodOptional<z.ZodNumber>;
            endColumn: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }, {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        severity: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        fix?: string | undefined;
    }, {
        message: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        severity: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        fix?: string | undefined;
    }>, "many">;
    summary: z.ZodObject<{
        totalFindings: z.ZodNumber;
        errors: z.ZodNumber;
        warnings: z.ZodNumber;
        filesScanned: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        filesScanned: number;
        totalFindings: number;
        errors: number;
        warnings: number;
    }, {
        filesScanned: number;
        totalFindings: number;
        errors: number;
        warnings: number;
    }>;
}, "strip", z.ZodTypeAny, {
    summary: {
        filesScanned: number;
        totalFindings: number;
        errors: number;
        warnings: number;
    };
    findings: {
        message: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        severity: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        fix?: string | undefined;
    }[];
}, {
    summary: {
        filesScanned: number;
        totalFindings: number;
        errors: number;
        warnings: number;
    };
    findings: {
        message: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        severity: string;
        endLine?: number | undefined;
        endColumn?: number | undefined;
        captures?: {
            name: string;
            endLine?: number | undefined;
            endColumn?: number | undefined;
            text?: string | undefined;
            startLine?: number | undefined;
            startColumn?: number | undefined;
        }[] | undefined;
        fix?: string | undefined;
    }[];
}>;
export type ScanResult = z.infer<typeof ScanResultSchema>;
/**
 * Schema for ast_run_rule rule construction parameters.
 */
export declare const RuleBuilderWhereClauseSchema: z.ZodObject<{
    metavariable: z.ZodString;
    regex: z.ZodOptional<z.ZodString>;
    notRegex: z.ZodOptional<z.ZodString>;
    equals: z.ZodOptional<z.ZodString>;
    includes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metavariable: string;
    includes?: string | undefined;
    regex?: string | undefined;
    notRegex?: string | undefined;
    equals?: string | undefined;
}, {
    metavariable: string;
    includes?: string | undefined;
    regex?: string | undefined;
    notRegex?: string | undefined;
    equals?: string | undefined;
}>;
export declare const RuleBuilderParamsSchema: z.ZodObject<{
    id: z.ZodString;
    language: z.ZodString;
    pattern: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    severity: z.ZodOptional<z.ZodDefault<z.ZodEnum<["error", "warning", "info"]>>>;
    kind: z.ZodOptional<z.ZodString>;
    insidePattern: z.ZodOptional<z.ZodString>;
    hasPattern: z.ZodOptional<z.ZodString>;
    notPattern: z.ZodOptional<z.ZodString>;
    where: z.ZodOptional<z.ZodArray<z.ZodObject<{
        metavariable: z.ZodString;
        regex: z.ZodOptional<z.ZodString>;
        notRegex: z.ZodOptional<z.ZodString>;
        equals: z.ZodOptional<z.ZodString>;
        includes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }, {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }>, "many">>;
    fix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    language: string;
    id: string;
    message?: string | undefined;
    severity?: "error" | "warning" | "info" | undefined;
    fix?: string | undefined;
    kind?: string | undefined;
    insidePattern?: string | undefined;
    hasPattern?: string | undefined;
    notPattern?: string | undefined;
    where?: {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }[] | undefined;
}, {
    pattern: string;
    language: string;
    id: string;
    message?: string | undefined;
    severity?: "error" | "warning" | "info" | undefined;
    fix?: string | undefined;
    kind?: string | undefined;
    insidePattern?: string | undefined;
    hasPattern?: string | undefined;
    notPattern?: string | undefined;
    where?: {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }[] | undefined;
}>;
export type RuleBuilderParams = z.infer<typeof RuleBuilderParamsSchema>;
export declare const RuleBuilderResultSchema: z.ZodObject<{
    yaml: z.ZodString;
    summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: string;
    yaml: string;
}, {
    summary: string;
    yaml: string;
}>;
export type RuleBuilderResult = z.infer<typeof RuleBuilderResultSchema>;
/**
 * Combined schema merging rule builder and scan parameters for ast_run_rule.
 */
export declare const RunRuleParamsSchema: z.ZodObject<{
    id: z.ZodString;
    language: z.ZodString;
    pattern: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodString>;
    insidePattern: z.ZodOptional<z.ZodString>;
    hasPattern: z.ZodOptional<z.ZodString>;
    notPattern: z.ZodOptional<z.ZodString>;
    where: z.ZodOptional<z.ZodArray<z.ZodObject<{
        metavariable: z.ZodString;
        regex: z.ZodOptional<z.ZodString>;
        notRegex: z.ZodOptional<z.ZodString>;
        equals: z.ZodOptional<z.ZodString>;
        includes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }, {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }>, "many">>;
    fix: z.ZodOptional<z.ZodString>;
} & {
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    format: z.ZodOptional<z.ZodDefault<z.ZodEnum<["json", "text", "github"]>>>;
    severity: z.ZodOptional<z.ZodDefault<z.ZodEnum<["error", "warning", "info", "all"]>>>;
    ruleIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
    relativePaths: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    jsonStyle: z.ZodOptional<z.ZodDefault<z.ZodEnum<["stream", "pretty", "compact"]>>>;
    follow: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    threads: z.ZodOptional<z.ZodNumber>;
    noIgnore: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    ignorePath: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    root: z.ZodOptional<z.ZodString>;
    workdir: z.ZodOptional<z.ZodString>;
    saveTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    language: string;
    id: string;
    root?: string | undefined;
    message?: string | undefined;
    paths?: string[] | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
    severity?: "error" | "warning" | "info" | "all" | undefined;
    fix?: string | undefined;
    kind?: string | undefined;
    insidePattern?: string | undefined;
    hasPattern?: string | undefined;
    notPattern?: string | undefined;
    where?: {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }[] | undefined;
    format?: "text" | "json" | "github" | undefined;
    ruleIds?: string[] | undefined;
    saveTo?: string | undefined;
}, {
    pattern: string;
    language: string;
    id: string;
    root?: string | undefined;
    message?: string | undefined;
    paths?: string[] | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    timeoutMs?: number | undefined;
    relativePaths?: boolean | undefined;
    noIgnore?: boolean | undefined;
    ignorePath?: string[] | undefined;
    workdir?: string | undefined;
    jsonStyle?: "stream" | "pretty" | "compact" | undefined;
    follow?: boolean | undefined;
    threads?: number | undefined;
    severity?: "error" | "warning" | "info" | "all" | undefined;
    fix?: string | undefined;
    kind?: string | undefined;
    insidePattern?: string | undefined;
    hasPattern?: string | undefined;
    notPattern?: string | undefined;
    where?: {
        metavariable: string;
        includes?: string | undefined;
        regex?: string | undefined;
        notRegex?: string | undefined;
        equals?: string | undefined;
    }[] | undefined;
    format?: "text" | "json" | "github" | undefined;
    ruleIds?: string[] | undefined;
    saveTo?: string | undefined;
}>;
export type RunRuleParams = z.infer<typeof RunRuleParamsSchema>;
//# sourceMappingURL=schemas.d.ts.map