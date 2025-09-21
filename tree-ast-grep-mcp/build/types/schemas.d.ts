import { z } from 'zod';
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
export declare const SearchParamsSchema: z.ZodObject<{
    pattern: z.ZodString;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    language: z.ZodOptional<z.ZodString>;
    context: z.ZodDefault<z.ZodNumber>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxMatches: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    context: number;
    maxMatches: number;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
}, {
    pattern: string;
    paths?: string[] | undefined;
    language?: string | undefined;
    context?: number | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    maxMatches?: number | undefined;
}>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;
export declare const ReplaceParamsSchema: z.ZodObject<{
    pattern: z.ZodString;
    replacement: z.ZodString;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    language: z.ZodOptional<z.ZodString>;
    dryRun: z.ZodDefault<z.ZodBoolean>;
    interactive: z.ZodDefault<z.ZodBoolean>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    pattern: string;
    replacement: string;
    dryRun: boolean;
    interactive: boolean;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
}, {
    pattern: string;
    replacement: string;
    paths?: string[] | undefined;
    language?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    dryRun?: boolean | undefined;
    interactive?: boolean | undefined;
}>;
export type ReplaceParams = z.infer<typeof ReplaceParamsSchema>;
export declare const ScanParamsSchema: z.ZodObject<{
    rules: z.ZodOptional<z.ZodString>;
    paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    format: z.ZodDefault<z.ZodEnum<["json", "text", "github"]>>;
    severity: z.ZodDefault<z.ZodEnum<["error", "warning", "info", "all"]>>;
    ruleIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    include: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    exclude: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    format: "json" | "text" | "github";
    severity: "error" | "warning" | "info" | "all";
    paths?: string[] | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    rules?: string | undefined;
    ruleIds?: string[] | undefined;
}, {
    paths?: string[] | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    rules?: string | undefined;
    format?: "json" | "text" | "github" | undefined;
    severity?: "error" | "warning" | "info" | "all" | undefined;
    ruleIds?: string[] | undefined;
}>;
export type ScanParams = z.infer<typeof ScanParamsSchema>;
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
export declare const SearchMatchSchema: z.ZodObject<{
    file: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
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
}, "strip", z.ZodTypeAny, {
    context: {
        before: string[];
        after: string[];
    };
    text: string;
    file: string;
    line: number;
    column: number;
    matchedNode: string;
}, {
    context: {
        before: string[];
        after: string[];
    };
    text: string;
    file: string;
    line: number;
    column: number;
    matchedNode: string;
}>;
export declare const SearchResultSchema: z.ZodObject<{
    matches: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        line: z.ZodNumber;
        column: z.ZodNumber;
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
    }, "strip", z.ZodTypeAny, {
        context: {
            before: string[];
            after: string[];
        };
        text: string;
        file: string;
        line: number;
        column: number;
        matchedNode: string;
    }, {
        context: {
            before: string[];
            after: string[];
        };
        text: string;
        file: string;
        line: number;
        column: number;
        matchedNode: string;
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
        text: string;
        file: string;
        line: number;
        column: number;
        matchedNode: string;
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
        text: string;
        file: string;
        line: number;
        column: number;
        matchedNode: string;
    }[];
    summary: {
        totalMatches: number;
        filesScanned: number;
        executionTime: number;
        language?: string | undefined;
    };
}>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
export declare const ReplaceChangeSchema: z.ZodObject<{
    file: z.ZodString;
    matches: z.ZodNumber;
    preview: z.ZodOptional<z.ZodString>;
    applied: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    file: string;
    matches: number;
    applied: boolean;
    preview?: string | undefined;
}, {
    file: string;
    matches: number;
    applied: boolean;
    preview?: string | undefined;
}>;
export declare const ReplaceResultSchema: z.ZodObject<{
    changes: z.ZodArray<z.ZodObject<{
        file: z.ZodString;
        matches: z.ZodNumber;
        preview: z.ZodOptional<z.ZodString>;
        applied: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        file: string;
        matches: number;
        applied: boolean;
        preview?: string | undefined;
    }, {
        file: string;
        matches: number;
        applied: boolean;
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
        preview?: string | undefined;
    }[];
}>;
export type ReplaceResult = z.infer<typeof ReplaceResultSchema>;
export declare const ScanFindingSchema: z.ZodObject<{
    ruleId: z.ZodString;
    severity: z.ZodString;
    message: z.ZodString;
    file: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
    fix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    severity: string;
    file: string;
    line: number;
    column: number;
    ruleId: string;
    fix?: string | undefined;
}, {
    message: string;
    severity: string;
    file: string;
    line: number;
    column: number;
    ruleId: string;
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
        fix: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        severity: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        fix?: string | undefined;
    }, {
        message: string;
        severity: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
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
        severity: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
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
        severity: string;
        file: string;
        line: number;
        column: number;
        ruleId: string;
        fix?: string | undefined;
    }[];
}>;
export type ScanResult = z.infer<typeof ScanResultSchema>;
//# sourceMappingURL=schemas.d.ts.map