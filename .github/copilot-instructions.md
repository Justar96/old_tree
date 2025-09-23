# GitHub Copilot Instructions for tree-ast-grep-mcp

## Project Philosophy: Ultra-Simplicity

This is a **direct, minimal wrapper** around ast-grep CLI with zero abstractions. The entire codebase prioritizes simplicity over enterprise patterns.

**Core Principle**: When in doubt, choose the simplest solution. Never add complexity.

## Architecture Overview

```
src/
├── index.ts           # MCP server entry point with CLI arg parsing
├── core/
│   ├── binary-manager.ts    # Direct ast-grep binary execution
│   └── workspace-manager.ts # Basic workspace root detection
├── tools/
│   ├── search.ts      # Direct ast-grep run --pattern
│   ├── replace.ts     # Direct ast-grep run --rewrite  
│   └── scan.ts        # Direct ast-grep scan --rule
└── types/errors.ts    # Simple error hierarchy
```

## Implementation Patterns

### Tool Structure (NON-NEGOTIABLE)
Every tool follows this exact pattern:
```typescript
async execute(params: any): Promise<any> {
  // 1. Basic validation (pattern required)
  // 2. Build ast-grep command array directly
  // 3. Execute ast-grep with minimal options
  // 4. Parse results simply
  // 5. Return structured data
}
```

### Command Building
- Build `args` array directly: `['run', '--pattern', pattern.trim()]`
- Add flags conditionally: `if (language) args.push('--lang', language)`
- Always use `--json=stream` for parsing
- No command abstraction layers

### Error Handling
- Use custom error types from `types/errors.ts`
- Throw `ValidationError` for user input issues
- Throw `ExecutionError` for ast-grep failures
- Simple try/catch blocks only

## Development Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Development with auto-reload
npm run dev

# Custom test runner (preferred)
npm test                    # Unit + integration
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only

# Test with Jest (alternative)
npx jest
```

## AST-Grep Integration Points

### Metavariable Conventions
- Named variables work best: `$NAME`, `$ARG`, `$BODY`
- Multi-node patterns: `$$$BODY` (always named, never bare `$$$`)
- Test patterns with ast-grep CLI first: `ast-grep run --pattern "console.log($ARG)" --lang javascript`

### Binary Management
- Auto-installs platform-specific binaries via optional dependencies
- Falls back to system PATH if available
- Custom binary path via `AST_GREP_BINARY_PATH` env var

## Testing Philosophy

- Custom test runner in `tests/runner.js` (not Jest by default)
- Direct imports using `file://` URLs for ESM compatibility
- Test categories: unit, integration, e2e, stress, security, real-world
- Inline code testing preferred over file fixtures

## Code Quality Rules

### DO:
- Duplicate simple code rather than abstract
- Use direct command execution
- Inline simple operations
- Build command arrays directly
- Parse JSON with basic string splitting

### DON'T:
- Create base classes or inheritance
- Abstract ast-grep command building
- Add complex error handling
- Create shared utilities
- Use performance optimizations that add complexity

## MCP Server Specifics

- Entry point: `src/index.ts` with CLI argument parsing
- Three main tools: `ast_search`, `ast_replace`, `ast_run_rule`
- Direct MCP SDK integration without middleware
- Workspace detection via simple `git rev-parse` or `package.json` lookup

## File Modification Guidelines

When editing existing files:
- Maintain the ultra-simple philosophy
- Keep the exact tool execution pattern
- Don't add abstractions or base classes
- Test patterns with ast-grep CLI before implementation
- Focus on direct command building and minimal parsing