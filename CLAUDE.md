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

Think carefully and implement the most concise solution that changes as little code as possible.

### Required Approach
1. **Read existing code first** - Always examine the codebase to understand patterns and reuse existing functions
2. **Question assumptions** - Ask clarifying questions if intent is unclear rather than guessing
3. **Favor simplicity** - Choose working solutions over "enterprise" patterns

### Error Handling Strategy
- **Fail fast** for critical configuration errors
- **Log and continue** for optional feature failures
- **Graceful degradation** when external services are unavailable
- **User-friendly messages** through proper error context

### Testing Requirements
- Use real services only - no mocking
- Complete each test fully before proceeding to the next
- Structure tests correctly before blaming the codebase
- Write verbose tests for debugging purposes

## Current Architecture

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

### Communication Style
- Provide criticism when warranted
- Suggest better approaches when they exist
- Reference relevant standards and conventions
- Be skeptical and concise
- Ask questions rather than making assumptions

### Code Quality Standards (NON-NEGOTIABLE)

**Implementation Standards:**
- Complete implementations only - no partial work or "TODO" comments
- No code duplication - reuse existing functions and constants
- No dead code - delete unused code entirely
- Clean separation of concerns
- No emojis use ascii characters or unicode characters if necessary.
- Use human written style.

- **Never leave function stubs** - If you cannot complete a function implementation:
  1. Stop immediately and inform the user
  2. Explain what information or decisions are needed
  3. Ask for comprehensive requirements before proceeding
  4. Do not create placeholder functions with TODO comments

**Testing Standards:**
- Test every function
- Design tests to reveal actual flaws and reflect real usage
- No superficial tests that merely check happy paths

**Architecture Standards:**
- Follow existing naming patterns consistently
- Avoid over-engineering - prefer simple functions over complex abstractions
- Prevent resource leaks - clean up connections, timeouts, and event listeners

Remember: **Simple is better than complex. Direct is better than abstract.**