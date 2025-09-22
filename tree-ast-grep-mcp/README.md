# tree-ast-grep MCP Server

A Model Context Protocol server that provides AI coding agents with AST-aware code search and manipulation capabilities using ast-grep.

## Installation

No manual installation required. Simply add this configuration to your MCP settings (e.g., `claude_desktop_config.json` or Kilo-Code settings):

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

The `npx` command will automatically download, cache, and run the server with the appropriate ast-grep binary for your platform. No separate `npm install` step is needed.

## Installation Process (For End Users)

### ✅ Option 1: Automatic Installation (Recommended)
Users only need to add this to their MCP configuration - no manual npm install required:

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

What happens:
- `npx` automatically downloads and caches the package
- `-y` skips installation prompts
- `--auto-install` downloads the appropriate ast-grep binary
- User does nothing else - it just works!

### ✅ Option 2: Pre-installation (Optional)
For users who prefer pre-installing:

```bash
# Optional: Pre-install globally (not required)
npm install -g tree-ast-grep-mcp
```

Then use in MCP config:
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

### ✅ Option 3: Lightweight (If ast-grep already installed)
```json
{
  "mcpServers": {
    "tree-ast-grep": {
      "command": "npx",
      "args": ["-y", "tree-ast-grep-mcp", "--use-system"]
    }
  }
}
```

### Key Benefits
- 🚀 Zero Installation Steps: Just add MCP config, done
- 📦 Automatic Package Management: npx handles everything
- 🔄 Auto-Updates: npx always uses latest version
- 💾 Smart Caching: Downloads once, reuses automatically
- 🎯 Platform Detection: Automatically gets right binary

### For Package Publishers
Once published to npm, users will:
1. Copy-paste the MCP configuration above
2. Start using ast-grep tools immediately
3. Never worry about manual installation

## Tools

### ast_search

Performs structural code search using AST patterns.

**Parameters:**
- `pattern` (string, required): AST pattern to search for
- `paths` (string[], optional): Target files/directories
- `language` (string, optional): Programming language hint
- `context` (number, optional): Lines of context (default: 3)
- `include` (string[], optional): Include glob patterns
- `exclude` (string[], optional): Exclude glob patterns
- `maxMatches` (number, optional): Maximum results (default: 100)

**Returns:** Array of matches with file locations and context.

### ast_replace

Performs structural find-and-replace operations.

**Parameters:**
- `pattern` (string, required): AST pattern to match
- `replacement` (string, required): Replacement template
- `paths` (string[], optional): Target files/directories
- `language` (string, optional): Programming language hint
- `dryRun` (boolean, optional): Preview changes (default: true)
- `include` (string[], optional): Include glob patterns
- `exclude` (string[], optional): Exclude glob patterns

**Returns:** Summary of changes made or preview.

### ast_run_rule

Generates and immediately executes custom ast-grep rules.

**Parameters:**
- `id` (string, required): Unique rule identifier
- `language` (string, required): Programming language
- `pattern` (string, required): AST pattern to match
- `message` (string, optional): Human-readable message
- `severity` (string, optional): Rule severity level ('error', 'warning', 'info')
- `paths` (string[], optional): Target files/directories
- `include` (string[], optional): Include glob patterns
- `exclude` (string[], optional): Exclude glob patterns
- `fix` (string, optional): Auto-fix replacement template

**Returns:** Generated YAML rule and execution results.

## ⚠️ Important: Pattern Reliability & Examples

For reliable pattern matching and replacement operations, please review these essential guides:

### [Pattern Examples Guide](./PATTERN_EXAMPLES.md) 🔍
- **Official ast-grep catalog patterns** - Production-tested examples
- **Language-specific patterns** - JavaScript, Python, Java, and more
- **Atomic, Relational & Composite rules** - From simple to advanced
- **Real-world migration patterns** - Console logging, function conversion, etc.

### [Metavariable Reliability Matrix](./METAVARIABLE_RELIABILITY.md) ⚠️
- **Critical reliability information** - Which patterns work in search vs replace
- **Common pitfalls** with `$_` and `$$$` metavariables 
- **Proven working examples** - Reliable patterns for consistent results
- **Troubleshooting guide** - Fix failed replacements

**Quick Summary**: Always use named metavariables like `$NAME`, `$FUNC`, `$ARG` in replacement operations. Start with [official catalog patterns](./PATTERN_EXAMPLES.md) for best results.

## Configuration Options

### Command Line Flags
- `--use-system`: Use system-installed ast-grep
- `--platform=<os>`: Install specific platform binary
- `--auto-install`: Auto-detect and install binary
- `--cache-dir=<path>`: Custom binary cache directory

### Environment Variables
- `WORKSPACE_ROOT`: Explicit workspace root
- `AST_GREP_BINARY_PATH`: Custom ast-grep binary path
- `AST_GREP_CACHE_DIR`: Binary cache directory
- `MAX_FILE_SIZE`: Maximum file size limit
- `MAX_FILES`: Maximum file count limit

## Security

- Operations restricted to configured workspace boundaries
- Path traversal prevention with comprehensive validation
- System directory access blocked
- Resource limits enforced
- Dry-run mode enabled by default for modifications

## Supported Languages

All languages supported by ast-grep including JavaScript, Python, Java, C/C++, Rust, Go, PHP, and Ruby.

## License

MIT