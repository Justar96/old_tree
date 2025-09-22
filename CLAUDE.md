# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview - SIMPLIFIED ARCHITECTURE

This is a **direct, minimal wrapper** around ast-grep CLI with zero abstractions. The entire codebase is intentionally simple and straightforward.

## Core Philosophy - ULTRA SIMPLICITY

**NEVER ADD COMPLEXITY**
- Direct ast-grep command execution only
- No abstractions, layers, or "enterprise" patterns
- Build command args → Execute → Parse results
- When in doubt, choose the simplest solution

## Current Architecture (SIMPLIFIED)

### Essential Files Only
```
src/
├── index.ts           # MCP server entry point
├── core/
│   ├── binary-manager.ts    # ast-grep binary execution
│   └── workspace-manager.ts # Basic workspace detection
├── tools/
│   ├── search.ts      # Direct ast-grep run --pattern
│   ├── replace.ts     # Direct ast-grep run --rewrite
│   └── scan.ts        # Direct ast-grep scan --rule
└── types/
    └── errors.ts      # Basic error types
```

### Tool Implementation Pattern

Each tool follows this **exact pattern**:
```typescript
async execute(params: any): Promise<any> {
  // 1. Basic validation (pattern required)
  // 2. Build ast-grep command array directly
  // 3. Execute ast-grep with minimal options
  // 4. Parse results simply
  // 5. Return structured data
}
```

**NO ABSTRACTIONS - NO INHERITANCE - NO COMPLEXITY**

## Development Rules (NON-NEGOTIABLE)

### Implementation Standards
- **Direct command execution only** - Never abstract ast-grep calls
- **Minimal validation** - Only validate what's absolutely required
- **Simple parsing** - Basic string/JSON processing only
- **Zero overhead** - No performance cost vs direct ast-grep usage
- **Complete implementations only** - No TODOs or partial work

### Architecture Constraints
- **No base classes** - Each tool is independent
- **No shared utilities** - Duplicate simple code if needed
- **No complex error handling** - Basic try/catch only
- **No resource management** - Let ast-grep handle everything
- **No path abstraction** - Use paths directly

### Code Quality
- **Favor duplication over abstraction**
- **Inline simple operations**
- **Direct variable access**
- **Minimal function calls**
- **Clear, obvious code flow**

## AST-Grep Integration - DIRECT ONLY

### Command Patterns (DO NOT ABSTRACT)
```bash
# Search
ast-grep run --pattern <PATTERN> --lang <LANG> --json=stream

# Replace
ast-grep run --pattern <PATTERN> --rewrite <REPLACEMENT> --lang <LANG>

# Scan
ast-grep scan --rule <RULE_FILE> --json=stream
```

### Metavariable Best Practices
- **Named variables work best**: `$NAME`, `$ARG`, `$BODY`
- **Multi-node patterns**: Use `$$$BODY` (named) not bare `$$$`
- **Simple patterns preferred**: `console.log($ARG)` vs complex structural patterns
- **Test patterns directly** with ast-grep CLI first

## Build and Development Commands

```bash
# Build the project
npm run build

# Development mode
npm run dev

# Test manually
node build/index.js
```

## Testing Philosophy

- **Test against direct ast-grep behavior** - Our tools must match exactly
- **Use inline code parameter** - Most reliable for testing
- **Start with simple patterns** - Build up complexity gradually
- **No mocking** - Use real ast-grep binary only

## What NOT to Do

❌ **Never create base classes or shared utilities**
❌ **Never add validation layers or complex error handling**
❌ **Never abstract ast-grep command construction**
❌ **Never add "enterprise" patterns or dependency injection**
❌ **Never optimize prematurely or add unnecessary features**

## What TO Do

✅ **Keep each tool file independent and simple**
✅ **Build ast-grep commands directly in arrays**
✅ **Parse results with basic string/JSON operations**
✅ **Return structured data that matches expected format**
✅ **Test every change against direct ast-grep CLI**

## Emergency Simplification

If the codebase ever becomes complex again:
1. **Delete all abstractions immediately**
2. **Revert to direct ast-grep command execution**
3. **Remove any inheritance or shared utilities**
4. **Keep only the essential 7 files**
5. **Test that behavior matches ast-grep CLI exactly**

Remember: **Simple is better than complex. Direct is better than abstract.**