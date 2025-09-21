# tree-ast-grep MCP Server - Comprehensive Development Plan

## Project Overview

This document provides comprehensive technical details for developers working on or extending the tree-ast-grep MCP server. The project transforms ast-grep's powerful AST manipulation capabilities into a standardized Model Context Protocol server for AI coding agents.

## Implementation Progress

### Phase 1: Architecture & Foundation ✅

#### 1.1 Project Structure Design
- **TypeScript Setup**: ES modules with strict type checking
- **Directory Structure**: Modular organization with clear separation of concerns
- **Build System**: Simple TypeScript compilation with npm scripts
- **Dependencies**: Minimal, focused on MCP SDK and validation

```
tree-ast-grep-mcp/
├── src/
│   ├── index.ts              # Main MCP server entry point
│   ├── tools/                # MCP tool implementations
│   │   ├── search.ts         # ast_search tool
│   │   ├── replace.ts        # ast_replace tool
│   │   └── scan.ts           # ast_scan tool
│   ├── core/                 # Core infrastructure
│   │   ├── binary-manager.ts # ast-grep binary management
│   │   ├── validator.ts      # Parameter validation
│   │   └── workspace-manager.ts # Security & workspace handling
│   └── types/                # Type definitions
│       ├── errors.ts         # Custom error types
│       └── schemas.ts        # Zod validation schemas
├── build/                    # Compiled JavaScript
├── package.json              # NPM configuration
├── tsconfig.json            # TypeScript configuration
├── README.md                # User documentation
└── PLAN.md                  # This technical documentation
```

#### 1.2 Error Handling System
Custom error hierarchy with specific error types:

```typescript
abstract class AstGrepMCPError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;
}

// Specific error types:
ValidationError    // Invalid parameters, recoverable
BinaryError       // Binary not found/invalid, not recoverable
SecurityError     // Path traversal attempts, not recoverable
TimeoutError      // Operation timeout, recoverable
FileSystemError   // File access issues, recoverable
ExecutionError    // ast-grep execution failure, recoverable
```

#### 1.3 Validation Framework
Comprehensive parameter validation using Zod schemas:
- **Type Safety**: Runtime validation with TypeScript types
- **Security**: Path traversal prevention, system directory blocking
- **Resource Limits**: File size and count constraints
- **Sanitization**: Input cleaning and normalization

### Phase 2: ast-grep Integration ✅

#### 2.1 Understanding ast-grep CLI Structure

ast-grep uses a command-based interface:

```bash
ast-grep <COMMAND> [OPTIONS] [PATHS]

Commands:
- run: Search/replace operations (primary use)
- scan: Rule-based analysis
- test: Test rules
- new: Create projects/rules
- lsp: Language server
```

**Critical Discovery**: ast-grep requires `--pattern` flag, not positional argument:
```bash
# CORRECT
ast-grep run --pattern 'console.log' --lang javascript file.js

# INCORRECT  
ast-grep run 'console.log' --lang javascript file.js
```

#### 2.2 Binary Management Strategy

**Multi-tier Binary Resolution**:
1. **Custom Path**: `AST_GREP_BINARY_PATH` environment variable
2. **Auto-Install**: Download platform-specific binary to cache
3. **System Binary**: Find ast-grep in PATH
4. **Graceful Failure**: Clear error messages with installation options

**Platform Support Matrix**:
| Platform | Architecture | Binary Size | Status |
|----------|-------------|-------------|---------|
| Windows  | x64         | 6.44 MB     | ✅ Tested |
| Windows  | ARM64       | 6.15 MB     | ✅ Implemented |
| macOS    | x64         | 6.95 MB     | ✅ Implemented |
| macOS    | ARM64       | 6.93 MB     | ✅ Implemented |
| Linux    | x64         | 7.1 MB      | ✅ Implemented |
| Linux    | ARM64       | 6.82 MB     | ✅ Implemented |

#### 2.3 Download & Caching Implementation

**Robust Download Process**:
- **Retry Logic**: 3 attempts with exponential backoff
- **Stream Processing**: Handles large files without memory issues
- **Cache Validation**: Tests binaries before use, removes corrupted files
- **Progress Reporting**: Shows download progress for user feedback

**Cache Management**:
- **Location**: `~/.ast-grep-mcp/binaries/`
- **Naming**: `ast-grep-{platform}-{arch}[.exe]`
- **Validation**: Version check with `--version` command
- **Cleanup**: Automatic removal of invalid binaries

### Phase 3: MCP Tool Implementation ✅

#### 3.1 ast_search Tool

**Purpose**: AST-aware code pattern search

**CLI Mapping**:
```bash
ast-grep run --pattern <PATTERN> --lang <LANG> --json=stream [PATHS]
```

**Parameter Translation**:
```typescript
// MCP Input
{
  pattern: "function logMessage",
  language: "javascript", 
  context: 3,
  paths: ["src/"]
}

// ast-grep Command
ast-grep run --pattern "function logMessage" --lang javascript --context 3 --json=stream src/
```

**JSON Output Parsing**:
ast-grep outputs JSON objects per match:
```json
{
  "text": "function logMessage(message) {\n    console.log(\"Debug: \" + message);\n}",
  "range": {
    "start": {"line": 1, "column": 0},
    "end": {"line": 3, "column": 1}
  },
  "file": "test-example.js",
  "language": "JavaScript"
}
```

**Output Normalization**:
- Convert 0-based line numbers to 1-based
- Extract context from range information
- Standardize field names across different ast-grep versions

#### 3.2 ast_replace Tool

**Purpose**: Structural find-and-replace operations

**CLI Mapping**:
```bash
ast-grep run --pattern <PATTERN> --rewrite <REPLACEMENT> --lang <LANG> [OPTIONS] [PATHS]
```

**Safety Features**:
- **Dry-run Default**: All operations default to preview mode
- **Backup Creation**: Automatic backups before modifications
- **Interactive Mode**: Built-in ast-grep interactive confirmation
- **Update-all Mode**: Batch operations for non-interactive use

**Parameter Translation**:
```typescript
// MCP Input
{
  pattern: "console.log($_)",
  replacement: "logger.info($_)",
  dryRun: true,
  interactive: false
}

// ast-grep Command (dry-run)
ast-grep run --pattern "console.log($_)" --rewrite "logger.info($_)" --json=stream

// ast-grep Command (apply)
ast-grep run --pattern "console.log($_)" --rewrite "logger.info($_)" --update-all --json=stream
```

#### 3.3 ast_scan Tool

**Purpose**: Rule-based code analysis and linting

**CLI Mapping**:
```bash
ast-grep scan --config <RULES_FILE> --json=stream [PATHS]
```

**Rule File Handling**:
- **Inline Rules**: Create temporary YAML file from string input
- **File Rules**: Validate and use existing rule files
- **Built-in Rules**: Future extension point for common patterns

**Configuration Example**:
```yaml
rules:
  - id: no-console-log
    message: Avoid console.log in production
    severity: warning
    language: javascript
    rule:
      pattern: console.log($_)
```

### Phase 4: Security & Safety Implementation ✅

#### 4.1 Workspace Security Model

**Boundary Enforcement**:
- **Root Detection**: Automatic detection using project indicators
- **Path Validation**: All paths resolved relative to workspace root
- **Traversal Prevention**: Block `../` and absolute paths outside workspace
- **System Protection**: Block access to system directories

**Project Root Detection Priority**:
1. Explicit `WORKSPACE_ROOT` environment variable
2. Auto-detection using indicators: `.git`, `package.json`, etc.
3. Fallback to current working directory

**Blocked Paths**:
```typescript
const SYSTEM_PATHS = [
  '/etc', '/bin', '/usr', '/sys', '/proc',           // Unix system
  'C:\\Windows', 'C:\\Program Files',               // Windows system
  '~/.ssh', '~/.aws',                               // Credentials
  'node_modules/.bin',                              // Executables
  '.git'                                            // Version control
];
```

#### 4.2 Resource Management

**File Limits**:
- **Maximum File Size**: 10MB per file (configurable)
- **Maximum File Count**: 10,000 files (configurable)  
- **Timeout Limits**: 30-60 seconds per operation
- **Memory Buffer**: 10MB stdout/stderr buffer

**Environment Variables**:
```bash
MAX_FILE_SIZE=10485760        # 10MB file size limit
MAX_FILES=10000              # File count limit
EXECUTION_TIMEOUT=30000      # Operation timeout (ms)
```

### Phase 5: AST Pattern Alignment ✅

#### 5.1 Understanding ast-grep Patterns

**Pattern Types**:

1. **Literal Patterns**: Exact text matching
   ```javascript
   // Pattern: "console.log"
   // Matches: console.log("hello")
   // Matches: console.log(variable)
   ```

2. **Metavariable Patterns**: Flexible matching
   ```javascript
   // Pattern: "console.log($_)"
   // $_ matches any single expression
   // Matches: console.log("hello"), console.log(x + y)
   ```

3. **Multi-variable Patterns**: Multiple captures
   ```javascript
   // Pattern: "function $NAME($ARGS) { $$$ }"
   // $NAME matches function name
   // $ARGS matches parameter list
   // $$$ matches function body
   ```

4. **Complex Patterns**: Nested structures
   ```javascript
   // Pattern: "if ($COND) { console.log($MSG) }"
   // Matches conditional console.log statements
   ```

#### 5.2 Pattern Translation Guidelines

**From User Intent to ast-grep Pattern**:

1. **Search for console.log calls**:
   ```
   User: "Find all console.log statements"
   Pattern: "console.log"
   Refined: "console.log($_)" (to capture arguments)
   ```

2. **Search for function declarations**:
   ```
   User: "Find function declarations"
   Pattern: "function"
   Refined: "function $NAME($ARGS) { $$$ }"
   ```

3. **Search for class methods**:
   ```
   User: "Find class methods"
   Pattern: "class $CLASS { $METHOD() { $$$ } }"
   ```

#### 5.3 Tool Adjustment Recommendations

**For ast_search Tool**:

1. **Pattern Enhancement**: Add pattern suggestion logic
   ```typescript
   function enhancePattern(userPattern: string, language: string): string {
     // If user provides simple identifier, suggest metavariable pattern
     if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(userPattern)) {
       if (language === 'javascript' || language === 'typescript') {
         return `${userPattern}($_)`;  // Enhance to capture calls
       }
     }
     return userPattern;
   }
   ```

2. **Language-Specific Defaults**: 
   ```typescript
   const LANGUAGE_PATTERNS = {
     javascript: {
       'functions': 'function $NAME($ARGS) { $$$ }',
       'classes': 'class $NAME { $$$ }',
       'imports': 'import $WHAT from $WHERE',
       'exports': 'export $WHAT'
     },
     java: {
       'methods': 'public $TYPE $NAME($ARGS) { $$$ }',
       'classes': 'public class $NAME { $$$ }',
       'interfaces': 'interface $NAME { $$$ }'
     }
   };
   ```

**For ast_replace Tool**:

1. **Replacement Templates**: Support metavariable substitution
   ```typescript
   // Pattern: "console.log($_)"
   // Replacement: "logger.info($_)"
   // Result: console.log("hello") → logger.info("hello")
   ```

2. **Context-Aware Replacements**: Consider surrounding code
   ```typescript
   // Pattern: "if ($COND) { console.log($MSG); }"
   // Replacement: "if ($COND) { logger.debug($MSG); }"
   ```

**For ast_scan Tool**:

1. **Rule Templates**: Provide common rule patterns
   ```yaml
   # Security rules
   - id: no-eval
     pattern: eval($_)
     message: "eval() is dangerous"
     severity: error

   # Style rules  
   - id: prefer-const
     pattern: let $VAR = $VAL
     message: "Use const for non-reassigned variables"
     severity: warning
   ```

### Phase 6: Advanced Features & Optimizations

#### 6.1 Pattern Intelligence

**Smart Pattern Detection**:
```typescript
class PatternIntelligence {
  // Suggest better patterns based on user input
  suggestPattern(input: string, language: string): string[] {
    const suggestions: string[] = [];
    
    // Function search enhancements
    if (input.includes('function')) {
      suggestions.push('function $NAME($ARGS) { $$$ }');
      suggestions.push('const $NAME = ($ARGS) => { $$$ }');
    }
    
    // Class search enhancements
    if (input.includes('class')) {
      suggestions.push('class $NAME extends $PARENT { $$$ }');
      suggestions.push('class $NAME { $$$ }');
    }
    
    return suggestions;
  }
}
```

**Language-Specific Pattern Libraries**:
```typescript
interface LanguagePatterns {
  [key: string]: {
    common: Record<string, string>;
    security: Record<string, string>;
    performance: Record<string, string>;
  };
}

const PATTERN_LIBRARY: LanguagePatterns = {
  javascript: {
    common: {
      'async-function': 'async function $NAME($ARGS) { $$$ }',
      'arrow-function': '($ARGS) => { $$$ }',
      'method-call': '$OBJ.$METHOD($ARGS)',
      'property-access': '$OBJ.$PROP'
    },
    security: {
      'eval-usage': 'eval($_)',
      'innerHTML': '$_.innerHTML = $_',
      'document-write': 'document.write($_)'
    },
    performance: {
      'dom-query': 'document.querySelector($_)',
      'loop-dom': 'for ($_) { document.querySelector($_) }'
    }
  }
};
```

#### 6.2 Advanced CLI Integration

**Command Argument Builder**:
```typescript
class AstGrepCommandBuilder {
  static buildSearchCommand(params: SearchParams): string[] {
    const args = ['run'];
    
    // Required pattern
    args.push('--pattern', params.pattern);
    
    // Language detection/specification
    if (params.language) {
      args.push('--lang', params.language);
    } else {
      // Auto-detect language from file extensions
      const detectedLang = this.detectLanguage(params.paths);
      if (detectedLang) {
        args.push('--lang', detectedLang);
      }
    }
    
    // Context options
    if (params.context > 0) {
      args.push('--context', params.context.toString());
    }
    
    // File filtering
    if (params.include?.length > 0) {
      params.include.forEach(pattern => {
        args.push('--globs', pattern);
      });
    }
    
    if (params.exclude?.length > 0) {
      params.exclude.forEach(pattern => {
        args.push('--globs', `!${pattern}`);
      });
    }
    
    // Output formatting
    args.push('--json=stream');  // Stream JSON for parsing
    args.push('--heading=never'); // Consistent output format
    
    // Paths (must be last)
    args.push(...params.paths);
    
    return args;
  }
}
```

#### 6.3 Result Processing & Normalization

**JSON Output Parsing**:
```typescript
interface AstGrepOutput {
  text: string;           // Matched code text
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  file: string;          // File path
  language: string;      // Detected language
  lines: string;         // Alternative text field
}

class ResultProcessor {
  parseSearchResults(stdout: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    
    // ast-grep outputs one JSON object per line in stream mode
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const astGrepMatch: AstGrepOutput = JSON.parse(line);
        
        // Normalize to MCP format
        const normalizedMatch: SearchMatch = {
          file: astGrepMatch.file,
          line: astGrepMatch.range.start.line + 1, // Convert to 1-based
          column: astGrepMatch.range.start.column,
          text: astGrepMatch.text || astGrepMatch.lines,
          context: this.extractContext(astGrepMatch),
          matchedNode: astGrepMatch.text || astGrepMatch.lines
        };
        
        matches.push(normalizedMatch);
      } catch (error) {
        console.error('Failed to parse ast-grep JSON:', error);
      }
    }
    
    return matches;
  }
}
```

### Phase 7: Production Considerations

#### 7.1 Performance Optimizations

**Binary Execution Optimization**:
- **Process Reuse**: Consider long-running ast-grep process for multiple operations
- **Batch Operations**: Group multiple patterns into single command
- **Memory Management**: 10MB buffer limits with streaming output
- **Timeout Handling**: Graceful cancellation with partial results

**Caching Strategy**:
```typescript
class OperationCache {
  // Cache frequently used patterns and results
  private patternCache = new Map<string, SearchResult>();
  
  async executeWithCache(
    operation: () => Promise<SearchResult>,
    cacheKey: string,
    ttl: number = 300000 // 5 minutes
  ): Promise<SearchResult> {
    const cached = this.patternCache.get(cacheKey);
    if (cached && this.isValidCache(cached, ttl)) {
      return cached;
    }
    
    const result = await operation();
    this.patternCache.set(cacheKey, result);
    return result;
  }
}
```

#### 7.2 Error Recovery & Diagnostics

**Diagnostic Information Collection**:
```typescript
interface DiagnosticInfo {
  binaryPath: string;
  binaryVersion: string;
  workspaceRoot: string;
  platformInfo: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
  operationMetrics: {
    executionTime: number;
    filesProcessed: number;
    cacheHitRate: number;
  };
}
```

**Progressive Fallback Strategy**:
1. **Primary**: Platform-specific binary execution
2. **Fallback 1**: System binary in PATH
3. **Fallback 2**: Alternative pattern matching (regex-based)
4. **Final**: Clear error with manual installation instructions

#### 7.3 Monitoring & Telemetry

**Operation Metrics**:
```typescript
interface OperationMetrics {
  toolName: string;
  executionTime: number;
  filesProcessed: number;
  matchesFound: number;
  errorCount: number;
  binaryPath: string;
  cacheHit: boolean;
}
```

## ast-grep Usage Pattern Deep Dive

### Pattern Syntax Reference

#### Basic Patterns
```bash
# Literal matching
--pattern "console.log"

# Single metavariable (matches any expression)
--pattern "console.log($_)"

# Named metavariable (can be referenced in replacement)
--pattern "console.log($MSG)"

# Multiple metavariables
--pattern "function $NAME($ARGS) { $$$ }"
```

#### Advanced Patterns
```bash
# Conditional patterns
--pattern "if ($COND) { $$$ }"

# Class patterns
--pattern "class $NAME extends $PARENT { $$$ }"

# Import/Export patterns
--pattern "import $WHAT from $WHERE"
--pattern "export { $EXPORTS } from $MODULE"

# Async patterns
--pattern "await $PROMISE"
--pattern "async function $NAME($ARGS) { $$$ }"
```

#### Language-Specific Patterns

**JavaScript/TypeScript**:
```bash
# React components
--pattern "function $COMPONENT(props) { return $$$ }"
--pattern "const $COMPONENT = () => { return $$$ }"

# Promise patterns
--pattern "$PROMISE.then($HANDLER)"
--pattern "new Promise(($RESOLVE, $REJECT) => { $$$ })"

# DOM manipulation
--pattern "document.getElementById($_)"
--pattern "$ELEMENT.addEventListener($EVENT, $HANDLER)"
```

**Java**:
```bash
# Method patterns
--pattern "public $TYPE $METHOD($ARGS) { $$$ }"
--pattern "@$ANNOTATION public $TYPE $METHOD($ARGS) { $$$ }"

# Class patterns
--pattern "public class $NAME extends $PARENT { $$$ }"
--pattern "@Entity public class $NAME { $$$ }"

# Spring patterns
--pattern "@Autowired private $TYPE $FIELD"
--pattern "@RequestMapping($PATH) public $TYPE $METHOD($ARGS) { $$$ }"
```

**Python**:
```bash
# Function patterns
--pattern "def $NAME($ARGS): $$$"
--pattern "async def $NAME($ARGS): $$$"

# Class patterns  
--pattern "class $NAME($PARENT): $$$"
--pattern "class $NAME: $$$"

# Decorator patterns
--pattern "@$DECORATOR def $NAME($ARGS): $$$"
```

### Tool Adjustment Guidelines

#### 5.1 Parameter Enhancement Strategies

**Auto-Pattern Enhancement**:
```typescript
function enhanceSearchPattern(pattern: string, language: string): string {
  // If pattern is just an identifier, make it more specific
  if (isSimpleIdentifier(pattern)) {
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Enhance function names to capture calls
        return `${pattern}($_)`; 
      case 'java':
        // Enhance method names to capture definitions
        return `$TYPE ${pattern}($ARGS) { $$$ }`;
      case 'python':
        // Enhance function names to capture definitions
        return `def ${pattern}($ARGS): $$$`;
    }
  }
  
  return pattern;
}
```

**Context-Aware Suggestions**:
```typescript
function suggestPatterns(intent: string, language: string): string[] {
  const suggestions: string[] = [];
  
  if (intent.includes('function')) {
    switch (language) {
      case 'javascript':
        suggestions.push('function $NAME($ARGS) { $$$ }');
        suggestions.push('const $NAME = ($ARGS) => { $$$ }');
        suggestions.push('async function $NAME($ARGS) { $$$ }');
        break;
      case 'java':
        suggestions.push('public $TYPE $NAME($ARGS) { $$$ }');
        suggestions.push('private $TYPE $NAME($ARGS) { $$$ }');
        break;
    }
  }
  
  return suggestions;
}
```

#### 5.2 Replacement Template Guidelines

**Template Validation**:
```typescript
function validateReplacement(pattern: string, replacement: string): ValidationResult {
  const patternVars = extractMetavariables(pattern);
  const replaceVars = extractMetavariables(replacement);
  
  // Ensure all replacement variables exist in pattern
  const unmatchedVars = replaceVars.filter(v => !patternVars.includes(v));
  
  if (unmatchedVars.length > 0) {
    return {
      valid: false,
      errors: [`Replacement variables not found in pattern: ${unmatchedVars.join(', ')}`]
    };
  }
  
  return { valid: true, errors: [] };
}
```

**Smart Replacement Suggestions**:
```typescript
const COMMON_REPLACEMENTS = {
  'console.log($_)': [
    'logger.info($_)',
    'logger.debug($_)', 
    'console.warn($_)',
    '// TODO: Remove debug log'
  ],
  'var $NAME = $VALUE': [
    'const $NAME = $VALUE',
    'let $NAME = $VALUE'
  ],
  'function $NAME($ARGS) { $$$ }': [
    'const $NAME = ($ARGS) => { $$$ }',
    'async function $NAME($ARGS) { $$$ }'
  ]
};
```

#### 5.3 Rule Development Guidelines

**Rule File Structure**:
```yaml
rules:
  - id: rule-identifier
    message: Human-readable description
    severity: error|warning|info
    language: javascript|java|python|etc
    rule:
      pattern: AST pattern to match
      inside: Optional container pattern
      not: Optional exclusion pattern
    fix: Optional replacement pattern
    note: Additional documentation
```

**Example Security Rules**:
```yaml
rules:
  - id: no-eval
    message: "Avoid eval() - security risk"
    severity: error
    language: javascript
    rule:
      pattern: eval($_)
    note: "eval() can execute arbitrary code"

  - id: sql-injection-risk
    message: "Potential SQL injection"
    severity: warning
    language: javascript
    rule:
      pattern: $DB.query($SQL)
      where:
        SQL:
          not: { pattern: "$_" } # Not a simple variable
    note: "Use parameterized queries"
```

**Example Style Rules**:
```yaml
rules:
  - id: prefer-const
    message: "Use const for non-reassigned variables"
    severity: warning
    language: javascript
    rule:
      pattern: let $VAR = $_
      not:
        inside: 
          any:
            - pattern: $VAR = $_
            - pattern: $VAR++
            - pattern: ++$VAR
    fix: const $VAR = $_

  - id: no-var
    message: "Use let or const instead of var"
    severity: warning
    language: javascript
    rule:
      pattern: var $VAR = $_
    fix: let $VAR = $_
```

### Future Enhancement Opportunities

#### 7.1 Interactive Mode Integration
- **Step-by-step Confirmation**: Integrate ast-grep's `--interactive` mode
- **Preview Mode**: Enhanced diff display for replacements
- **Batch Operations**: Queue multiple operations for user review

#### 7.2 Language Server Integration
- **Real-time Analysis**: Use ast-grep LSP for live feedback
- **IDE Integration**: Provide diagnostics and quick fixes
- **Workspace Analysis**: Background analysis with caching

#### 7.3 Rule Management
- **Rule Repository**: Curated collection of common rules
- **Custom Rules**: User-defined rule management
- **Rule Validation**: Test rules against sample code

#### 7.4 Performance Enhancements
- **Parallel Processing**: Multiple ast-grep processes for large codebases
- **Incremental Analysis**: Only analyze changed files
- **Smart Caching**: Cache results based on file fingerprints

## Installation & Deployment

### Package Distribution Strategy

**Multiple Package Approach**:
1. **Core Package** (`@cabbages/tree-ast-grep-mcp`): 200KB
   - MCP server implementation
   - Binary management logic
   - Auto-download capabilities

2. **Platform Packages**: 7MB each
   - Contains pre-compiled binaries
   - Faster installation for specific platforms

3. **Full Package**: 40MB
   - All platform binaries included
   - Offline deployment support

### MCP Configuration Examples

**Standard Configuration**:
```json
{
  "mcpServers": {
    "tree-ast-grep": {
      "command": "npx",
      "args": ["-y", "@cabbages/tree-ast-grep-mcp", "--auto-install"]
    }
  }
}
```

**Advanced Configuration**:
```json
{
  "mcpServers": {
    "tree-ast-grep": {
      "command": "npx",
      "args": ["-y", "@cabbages/tree-ast-grep-mcp", "--platform=win32"],
      "env": {
        "WORKSPACE_ROOT": "C:/Projects/MyApp",
        "AST_GREP_CACHE_DIR": "C:/Tools/ast-grep-cache",
        "MAX_FILE_SIZE": "20971520",
        "MAX_FILES": "20000"
      }
    }
  }
}
```

This comprehensive plan provides all the technical details needed for developers to understand, maintain, and extend the tree-ast-grep MCP server implementation.