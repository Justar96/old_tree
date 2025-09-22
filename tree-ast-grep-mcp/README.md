# tree-ast-grep MCP Server

A **simple, direct wrapper** around ast-grep for AI coding agents. Zero abstractions, maximum performance, perfect ast-grep compatibility.

## 🚀 Quick Start

Add to your MCP settings:

```json
{
  "mcpServers": {
    "tree-ast-grep": {
      "command": "npx",
      "args": ["-y", "tree-ast-grep-mcp", "--auto-install"]
    }
  }
}
```

## 🎯 What It Does

Three simple tools that directly execute ast-grep commands:

- **`ast_search`** → `ast-grep run --pattern` (structural code search)
- **`ast_replace`** → `ast-grep run --rewrite` (AST-aware replacements)
- **`ast_run_rule`** → `ast-grep scan --rule` (generate & run custom rules)

## ✨ Key Features

- **Zero Overhead** - Direct ast-grep execution, no abstractions
- **Perfect Compatibility** - Behaves exactly like ast-grep CLI
- **Inline Code Support** - Test patterns without files
- **Named Metavariables** - `$NAME`, `$ARG`, `$$$BODY` work perfectly
- **Auto-Install** - Downloads platform-specific ast-grep binary
- **Minimal Codebase** - ~300 lines, crystal clear logic

## 📖 Usage Examples

### Search for Patterns
```javascript
// Find all console.log statements
ast_search({
  pattern: "console.log($ARG)",
  language: "javascript",
  code: "console.log('hello'); console.log('world');"
})
```

### Replace Code Structures
```javascript
// Convert var to let
ast_replace({
  pattern: "var $NAME = $VALUE",
  replacement: "let $NAME = $VALUE",
  language: "javascript",
  code: "var x = 5; var y = 10;"
})
```

### Generate Custom Rules
```javascript
// Create linting rule
ast_run_rule({
  id: "no-console-log",
  pattern: "console.log($ARG)",
  message: "Use logger.info instead",
  language: "javascript",
  fix: "logger.info($ARG)"
})
```

## 🏗️ Architecture

**Intentionally Simple:**
```
src/
├── index.ts           # MCP server
├── core/
│   ├── binary-manager.ts    # Execute ast-grep
│   └── workspace-manager.ts # Find workspace root
├── tools/
│   ├── search.ts      # Direct search
│   ├── replace.ts     # Direct replace
│   └── scan.ts        # Direct scan
└── types/errors.ts    # Basic errors
```

Each tool: Validate → Build Command → Execute → Parse → Return

## 🧪 Testing

Patterns work exactly like ast-grep CLI:

```bash
# Test patterns directly
ast-grep run --pattern "console.log($ARG)" --lang javascript file.js

# Test replacements
ast-grep run --pattern "var $NAME" --rewrite "let $NAME" --lang javascript file.js

# Test rules
ast-grep scan --rule rule.yml file.js
```

## ⚡ Performance

- **Direct Execution** - No overhead vs ast-grep CLI
- **Streaming JSON** - Fast results parsing
- **Binary Caching** - One-time download per platform
- **Minimal Memory** - No complex abstractions

## 🔧 Configuration Options

```bash
# Lightweight (requires system ast-grep)
npx tree-ast-grep-mcp --use-system

# Platform-specific binary
npx tree-ast-grep-mcp --platform=win32

# Auto-detect platform (recommended)
npx tree-ast-grep-mcp --auto-install
```

## 📝 Metavariable Guide

**✅ Reliable Patterns:**
- `$NAME`, `$ARG`, `$VALUE` (single nodes)
- `$$$BODY`, `$$$ARGS` (named multi-nodes)
- `console.log($ARG)` → `logger.info($ARG)`

**⚠️ Use With Care:**
- Bare `$$$` produces literal "$$$" in replacements
- Complex structural patterns may not match reliably

## 🚫 What This ISN'T

- ❌ A complex AST manipulation framework
- ❌ A wrapper with proprietary pattern syntax
- ❌ An abstraction layer over ast-grep
- ❌ A reimplementation of ast-grep functionality

## ✅ What This IS

- ✅ Direct ast-grep command execution
- ✅ Minimal MCP protocol wrapper
- ✅ Perfect CLI compatibility
- ✅ Zero-overhead tool integration
- ✅ Simple, maintainable codebase

## 🤝 Contributing

Keep it simple! Follow the CLAUDE.md guidelines:
- No abstractions or base classes
- Direct command execution only
- Test against ast-grep CLI behavior
- Favor duplication over complexity

## 📄 License

MIT License - Use freely, keep it simple!