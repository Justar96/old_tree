# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Principles

### Core Philosophy
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

## Build and Development Commands

```bash
# Build the project
npm run build

# Development mode with hot reload
npm run dev

# Clean build artifacts
npm run clean

# Full build preparation for publishing
npm run prepublishOnly
```

## Testing

The project uses simple test files in the root directory:
- `test-client.js` - Basic client functionality tests
- `test-example.js` - Example usage demonstrations

Run tests manually by executing:
```bash
node test-client.js
node test-example.js
```

## Project Architecture

### Core Components

**MCP Server Entry Point (`src/index.ts`)**
- Parses command-line arguments for installation options (`--use-system`, `--auto-install`, `--platform=<os>`)
- Initializes binary manager, workspace manager, and tool handlers
- Handles MCP protocol communication via stdio transport
- Provides structured error handling with different error types

**Binary Management (`src/core/binary-manager.ts`)**
- Multi-tier binary resolution strategy:
  1. Custom path via `AST_GREP_BINARY_PATH` env var
  2. Auto-install platform-specific binary to cache
  3. System binary from PATH
  4. Graceful failure with installation instructions
- Automatic download and caching of ast-grep binaries for different platforms
- Binary validation and version checking

**Workspace Security (`src/core/workspace-manager.ts`)**
- Enforces workspace boundaries to prevent path traversal attacks
- Auto-detects project root using indicators (`.git`, `package.json`, etc.)
- Blocks access to system directories and sensitive paths
- Validates all file paths against workspace boundaries

**Parameter Validation (`src/core/validator.ts`)**
- Comprehensive Zod-based schema validation
- Resource limit enforcement (file size, count, timeout)
- Input sanitization and normalization
- Security validation for path traversal prevention

### Tool Implementation

**AST Search (`src/tools/search.ts`)**
- Maps to `ast-grep run --pattern <PATTERN> --lang <LANG> --json=stream`
- Supports context lines, glob patterns, and language hints
- Parses JSON output and normalizes line numbers (0-based to 1-based)
- Returns structured search results with file locations and context

**AST Replace (`src/tools/replace.ts`)**
- Maps to `ast-grep run --pattern <PATTERN> --rewrite <REPLACEMENT>`
- Defaults to dry-run mode for safety
- Supports interactive and batch replacement modes
- Provides preview functionality before applying changes

**AST Scan (`src/tools/scan.ts`)**
- Maps to `ast-grep scan --config <RULES_FILE> --json=stream`
- Supports inline YAML rules and external rule files
- Performs rule-based code analysis and linting
- Returns structured analysis results with findings

### Type System

**Schemas (`src/types/schemas.ts`)**
- Zod schemas for all parameter validation
- Type inference for TypeScript safety
- Default values and constraints for all parameters
- Workspace configuration and tool parameter types

**Error Handling (`src/types/errors.ts`)**
- Custom error hierarchy with specific error types:
  - `ValidationError` - Invalid parameters (recoverable)
  - `BinaryError` - Binary issues (not recoverable)
  - `SecurityError` - Path security violations (not recoverable)
  - `ExecutionError` - ast-grep execution failure (recoverable)
  - `TimeoutError` - Operation timeout (recoverable)

## Environment Variables

- `AST_GREP_BINARY_PATH` - Custom ast-grep binary path
- `AST_GREP_CACHE_DIR` - Binary cache directory (default: `~/.ast-grep-mcp/binaries/`)
- `WORKSPACE_ROOT` - Explicit workspace root directory
- `MAX_FILE_SIZE` - Maximum file size limit (default: 10MB)
- `MAX_FILES` - Maximum file count limit (default: 10,000)

## Installation Options

The server supports multiple installation modes via command-line flags:
- `--use-system` - Use system-installed ast-grep (lightweight)
- `--auto-install` - Auto-detect and install platform binary
- `--platform=<os>` - Install specific platform binary (win32, darwin, linux)
- `--cache-dir=<path>` - Custom binary cache directory

## Security Model

- All operations restricted to workspace boundaries
- Path traversal prevention with comprehensive validation
- System directory access blocked (Windows system dirs, Unix /etc, /bin, etc.)
- Resource limits enforced (file size, count, execution timeout)
- Dry-run mode enabled by default for modification operations

## ast-grep Integration

The project integrates with ast-grep CLI using specific command patterns:
- **Search**: `ast-grep run --pattern <PATTERN> --lang <LANG> --json=stream [PATHS]`
- **Replace**: `ast-grep run --pattern <PATTERN> --rewrite <REPLACEMENT> --update-all [PATHS]`
- **Scan**: `ast-grep scan --config <RULES_FILE> --json=stream [PATHS]`

Pattern syntax supports:
- Literal patterns: `"console.log"`
- Metavariables: `"console.log($_)"` (single expression)
- Multiple variables: `"function $NAME($ARGS) { $$$ }"` (body content)
- Language-specific patterns for JavaScript, Python, Java, etc.

## Development Notes

- Project uses ES modules with TypeScript compilation to `build/` directory
- Minimal dependencies: MCP SDK and Zod for validation
- Platform-specific binaries managed through optional dependencies
- No traditional test framework - uses simple Node.js test files
- Error messages include context for debugging and user guidance