# Design Document

## Overview

Old-Tree MCP delivers sub-500ms legacy codebase analysis through a performance-optimized architecture built on three core principles:

1. **Zero-Vector Analysis**: Pure AST parsing eliminates preprocessing overhead and ensures deterministic results
2. **Progressive Disclosure**: Shallow scans for rapid exploration, deep analysis on demand for detailed investigation  
3. **Cache-First Strategy**: Multi-tier caching with intelligent invalidation maintains performance across repeated analyses

**Key Performance Targets**:
- Response Time: <500ms for 100k LOC codebases
- Cache Hit Rate: >90% for iterative analysis workflows
- Memory Efficiency: <1GB peak usage for deep analysis
- Error Recovery: >99% analysis completion rate despite code quality issues

**Supported Legacy Languages**: COBOL (priority), Java (priority), FORTRAN, PHP with extensible architecture for additional languages.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "MCP Clients"
        A1[Claude Desktop]
        A2[Kiro IDE]
        A3[Custom Clients]
    end
    
    subgraph "Old-Tree MCP Server"
        B[MCP Protocol Handler]
        C[Request Validator]
        D[Tool Router]
        
        subgraph "Core Processing"
            E[AST Engine]
            F[Cache Manager]
            G[Worker Pool]
        end
        
        subgraph "Language Support"
            H1[COBOL Processor]
            H2[Java Processor]
            H3[FORTRAN Processor]
            H4[PHP Processor]
        end
        
        subgraph "Analysis Engines"
            I1[Structure Analyzer]
            I2[Dependency Analyzer]
            I3[Metrics Calculator]
        end
        
        J[Result Formatter]
        K[Performance Monitor]
    end
    
    subgraph "AST Implementations"
        L1[@ast-grep/napi - Primary]
        L2[@ast-grep/wasm - Fallback]
        L3[ast-grep CLI - Last Resort]
    end
    
    A1 --> B
    A2 --> B
    A3 --> B
    B --> C
    C --> D
    D --> E
    E --> F
    E --> G
    E --> L1
    E --> L2
    E --> L3
    G --> H1
    G --> H2
    G --> H3
    G --> H4
    H1 --> I1
    H2 --> I1
    H3 --> I1
    H4 --> I1
    I1 --> I2
    I2 --> I3
    I3 --> J
    J --> B
    K --> B
```

### Core Components

#### 1. MCP Protocol Handler
- **Purpose**: Manages MCP protocol communication with comprehensive client support
- **Technology**: @modelcontextprotocol/sdk TypeScript SDK v1.0+
- **Key Features**:
  - Protocol version negotiation and capability detection
  - Streaming response support for large analysis results
  - Connection pooling and keep-alive management
  - Request/response correlation and timeout handling
- **Performance Targets**:
  - Protocol overhead: <10ms per request
  - Concurrent connections: 100+ simultaneous clients
  - Message throughput: 1000+ messages/second

#### 2. Request Validator & Tool Router
- **Purpose**: Intelligent request routing with comprehensive validation
- **Key Features**:
  - Parameter schema validation with helpful error messages
  - Workspace path resolution and security checks
  - Rate limiting per client with burst allowance
  - Resource constraint enforcement based on system capacity
- **Routing Logic**:
  - `create_tree` → Structure Analysis Pipeline
  - `find_branch` → Dependency Analysis Pipeline
  - Health checks → System diagnostics
  - Custom tools → Plugin architecture (future)

#### 3. AST Engine with Intelligent Fallbacks
- **Purpose**: High-performance AST processing with automatic optimization
- **Implementation Strategy**:
  - **Primary**: @ast-grep/napi (native Rust, 10x faster than alternatives)
  - **Fallback 1**: @ast-grep/wasm (cross-platform compatibility)
  - **Fallback 2**: ast-grep CLI (universal availability)
  - **Emergency**: Regex-based extraction (basic functionality)
- **Smart Features**:
  - Runtime performance benchmarking and optimal implementation selection
  - Automatic fallback on implementation failures with zero user impact
  - Implementation-specific optimization (memory vs. speed trade-offs)
  - Parallel processing coordination across worker threads

#### 4. Multi-Tier Cache Manager
- **Purpose**: Intelligent caching system optimized for iterative analysis workflows
- **Cache Architecture**:
  - **L1 - File Fingerprints**: XXHash64 for sub-millisecond change detection
  - **L2 - AST Cache**: Parsed syntax trees with incremental updates
  - **L3 - Analysis Results**: Computed metrics, dependencies, and relationships
  - **L4 - Aggregated Views**: Full workspace analysis results
- **Advanced Features**:
  - Predictive cache warming based on usage patterns
  - Memory pressure-aware eviction with priority scoring
  - Cross-session persistence for frequently analyzed workspaces
  - Cache analytics and hit rate optimization

#### 5. Language Processors with Legacy Focus
- **Purpose**: Specialized processors optimized for legacy language patterns
- **COBOL Processor (Priority 1)**:
  - Advanced PROCEDURE DIVISION parsing with paragraph/section hierarchy
  - COPY statement resolution with include path management
  - Data structure analysis (WORKING-STORAGE, FILE SECTION)
  - Control flow analysis (PERFORM, GO TO, CALL statements)
- **Java Processor (Priority 1)**:
  - Enterprise pattern recognition (Spring, JEE, Hibernate)
  - Annotation-driven configuration analysis
  - Package dependency mapping with version conflict detection
  - Legacy framework support (Struts, JSF, EJB)
- **FORTRAN/PHP Processors (Priority 2)**:
  - Module system analysis and cross-references
  - Legacy syntax support and dialect detection
- **Extensible Architecture**: Plugin system for additional languages

#### 6. Advanced Analysis Engines
- **Structure Analyzer**:
  - Hierarchical code organization with configurable depth
  - Entity relationship mapping (inheritance, composition, aggregation)
  - Cross-reference analysis with confidence scoring
- **Dependency Analyzer**:
  - Multi-level dependency graph construction (file, module, function)
  - Impact analysis with change propagation modeling
  - Circular dependency detection with break-point suggestions
  - Dead code identification with usage pattern analysis
- **Metrics Calculator**:
  - Code quality metrics (complexity, maintainability, technical debt)
  - Performance indicators (algorithmic complexity, resource usage)
  - Security vulnerability patterns (injection, XSS, buffer overflows)
  - Legacy-specific metrics (COBOL complexity, Java enterprise patterns)

## Components and Interfaces

### Core Interfaces

```typescript
// Core server interface
interface OldTreeServer {
  server: MCPServer;
  analyzer: ASTAnalyzer;
  cache: CacheManager;
  serializer: ResultSerializer;
}

// AST Engine interface
interface ASTEngine {
  implementations: {
    native: '@ast-grep/napi';
    wasm: '@ast-grep/wasm';
    cli: 'ast-grep-binary';
  };
  activeImpl: string;
  parse(source: string, language: Language): Promise<SgRoot>;
  detectOptimalImplementation(): Promise<string>;
}

// Cache Manager interface
interface CacheManager {
  fileCache: LRUCache<string, FileFingerprint>;
  astCache: LRUCache<string, SgRoot>;
  resultCache: LRUCache<string, AnalysisResult>;
  
  getFileFingerprint(path: string): Promise<string>;
  getCachedAST(fingerprint: string): Promise<SgRoot | null>;
  setCachedAST(fingerprint: string, ast: SgRoot): Promise<void>;
  invalidateCache(pattern: string): Promise<void>;
}
```

### Tool Interfaces

```typescript
// create_tree tool interface
interface CreateTreeInput {
  workspace: string;
  profile: AnalysisProfile;
  rules: TreeGenerationRules;
  output: OutputConfiguration;
}

interface CreateTreeOutput {
  tree: CodeTree;
  metrics?: AnalysisMetrics;
  metadata: {
    analysisTime: number;
    filesProcessed: number;
    cacheHitRate: number;
    language: string | string[];
  };
}

// find_branch tool interface
interface FindBranchInput {
  target: TargetSpecification;
  analysis: AnalysisType;
  traversal: TraversalOptions;
  filters: FilterConfiguration;
}

interface FindBranchOutput {
  target: ResolvedTarget;
  branches: DependencyBranch[];
  summary: AnalysisSummary;
  visualization: GraphVisualization;
  metadata: {
    analysisTime: number;
    nodesTraversed: number;
    maxDepthReached: number;
  };
}
```

### Worker Thread Architecture

```typescript
// Worker thread for parallel processing
interface ASTWorker {
  workerData: {
    files: string[];
    options: ProcessingOptions;
  };
  
  process(): Promise<ASTResult[]>;
}

// Main thread coordination
interface WorkerCoordinator {
  workers: Worker[];
  chunkFiles(files: string[], workerCount: number): string[][];
  distributeWork(chunks: string[][]): Promise<ASTResult[]>;
  aggregateResults(results: ASTResult[][]): Promise<AnalysisResult>;
}
```

## Data Models

### Core Data Structures

```typescript
// File fingerprint for caching
interface FileFingerprint {
  path: string;
  hash: string;
  size: number;
  lastModified: number;
  language: Language;
}

// Code tree structure
interface CodeTree {
  root: TreeNode;
  metadata: {
    totalNodes: number;
    maxDepth: number;
    languages: Language[];
  };
}

interface TreeNode {
  id: string;
  type: EntityType;
  name: string;
  path: string;
  range: SourceRange;
  children: TreeNode[];
  relationships: Relationship[];
  metrics?: NodeMetrics;
}

// Dependency graph
interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    stronglyConnectedComponents: string[][];
    circularDependencies: CircularDependency[];
  };
}

interface GraphNode {
  id: string;
  type: EntityType;
  path: string;
  name: string;
  metrics: NodeMetrics;
  vulnerabilities: SecurityIssue[];
}

interface GraphEdge {
  from: string;
  to: string;
  type: RelationshipType;
  weight: number;
  metadata: EdgeMetadata;
}
```

### Analysis Profiles

```typescript
interface AnalysisProfile {
  preset?: 'quick' | 'balanced' | 'deep' | 'custom';
  custom?: {
    maxDepth: number;        // 1-20
    maxFiles: number;        // 100-100000
    maxFileSize: number;     // bytes
    parallelism: number;     // 1-16
    timeout: number;         // ms
    sampling?: {
      enabled: boolean;
      strategy: 'random' | 'weighted' | 'strategic';
      rate: number;          // 0.1-1.0
    };
  };
}

// Predefined profiles
const ANALYSIS_PROFILES = {
  quick: {
    maxDepth: 3,
    maxFiles: 1000,
    maxFileSize: 100 * 1024,
    parallelism: 4,
    timeout: 5000,
    sampling: { enabled: true, strategy: 'strategic', rate: 0.3 }
  },
  balanced: {
    maxDepth: 5,
    maxFiles: 10000,
    maxFileSize: 500 * 1024,
    parallelism: 8,
    timeout: 30000,
    sampling: { enabled: true, strategy: 'weighted', rate: 0.6 }
  },
  deep: {
    maxDepth: 10,
    maxFiles: 100000,
    maxFileSize: 5 * 1024 * 1024,
    parallelism: 16,
    timeout: 300000,
    sampling: { enabled: false }
  }
};
```

## Error Handling

### Error Recovery Strategy

```typescript
interface ErrorRecoveryStrategy {
  // Parse error recovery
  handleParseError(file: string, error: Error): Promise<PartialResult>;
  
  // Implementation fallback
  handleImplementationFailure(impl: string): Promise<string>;
  
  // Timeout handling
  handleTimeout(operation: string, partialResult?: any): Promise<Result>;
  
  // Resource exhaustion
  handleResourceExhaustion(resource: string): Promise<void>;
}

// Error types and handling
enum ErrorType {
  PARSE_ERROR = 'parse_error',
  TIMEOUT = 'timeout',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  IMPLEMENTATION_FAILURE = 'implementation_failure',
  INVALID_INPUT = 'invalid_input'
}

interface ErrorContext {
  type: ErrorType;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stackTrace?: string;
  recoveryAction?: string;
}
```

### Graceful Degradation

1. **Parse Failures**: Continue with remaining files, report partial results
2. **Implementation Failures**: Automatic fallback to next available implementation
3. **Timeout Handling**: Return partial results with timeout indication
4. **Memory Constraints**: Enable sampling and reduce parallelism
5. **File Size Limits**: Skip oversized files, continue processing

## Testing Strategy

### Unit Testing

```typescript
// AST Engine tests
describe('ASTEngine', () => {
  test('should detect optimal implementation', async () => {
    const engine = new ASTEngine();
    const impl = await engine.detectOptimalImplementation();
    expect(['native', 'wasm', 'cli']).toContain(impl);
  });
  
  test('should fallback on implementation failure', async () => {
    const engine = new ASTEngine();
    // Mock native implementation failure
    jest.spyOn(engine.implementations, 'native').mockRejectedValue(new Error());
    const result = await engine.parse('console.log("test")', Language.JavaScript);
    expect(result).toBeDefined();
  });
});

// Cache Manager tests
describe('CacheManager', () => {
  test('should cache and retrieve AST results', async () => {
    const cache = new CacheManager();
    const fingerprint = 'test-hash';
    const mockAST = createMockAST();
    
    await cache.setCachedAST(fingerprint, mockAST);
    const retrieved = await cache.getCachedAST(fingerprint);
    expect(retrieved).toEqual(mockAST);
  });
});
```

### Integration Testing

```typescript
// Tool integration tests
describe('CreateTreeTool', () => {
  test('should analyze COBOL codebase within time limits', async () => {
    const tool = new CreateTreeTool();
    const startTime = Date.now();
    
    const result = await tool.execute({
      workspace: './test-fixtures/cobol-project',
      profile: { preset: 'quick' },
      rules: {
        language: 'cobol',
        extraction: { entities: ['function', 'module'] }
      }
    });
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5 second limit for quick profile
    expect(result.tree).toBeDefined();
    expect(result.metadata.filesProcessed).toBeGreaterThan(0);
  });
});
```

### Performance Testing

```typescript
// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('should meet sub-500ms target for small codebases', async () => {
    const files = generateTestFiles(1000); // 1k files
    const startTime = performance.now();
    
    const result = await analyzeCodebase(files);
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(500); // Sub-500ms requirement
  });
  
  test('should handle 100k LOC within performance targets', async () => {
    const largeCodebase = generateLargeCodebase(100000); // 100k LOC
    const startTime = performance.now();
    
    const result = await analyzeCodebase(largeCodebase, { profile: 'balanced' });
    
    const duration = performance.now() - startTime;
    expect(duration).toBeLessThan(30000); // 30 second limit for balanced profile
    expect(result.metadata.cacheHitRate).toBeGreaterThan(0.5); // Effective caching
  });
});
```

### End-to-End Testing

```typescript
// MCP protocol testing
describe('MCP Integration', () => {
  test('should handle complete create_tree workflow', async () => {
    const client = new MCPClient();
    await client.connect();
    
    // List available tools
    const tools = await client.listTools();
    expect(tools.tools.map(t => t.name)).toContain('create_tree');
    
    // Call create_tree tool
    const result = await client.callTool('create_tree', {
      workspace: './test-fixtures/java-project',
      profile: { preset: 'quick' },
      rules: { language: 'java' }
    });
    
    expect(result.content[0].type).toBe('text');
    const analysis = JSON.parse(result.content[0].text);
    expect(analysis.tree).toBeDefined();
    expect(analysis.metadata.language).toBe('java');
  });
});
```

## Performance Optimization

### Caching Strategy

1. **File-level Caching**: XXHash fingerprinting for fast change detection
2. **AST-level Caching**: Incremental parsing with tree-sitter persistence
3. **Result-level Caching**: LRU cache with TTL for computed analysis results
4. **Memory Management**: Automatic cache eviction based on memory pressure

### Parallel Processing

1. **Worker Threads**: Distribute file processing across CPU cores
2. **Chunk Optimization**: Intelligent file chunking based on size and complexity
3. **Load Balancing**: Dynamic work distribution to prevent bottlenecks
4. **Resource Monitoring**: Automatic scaling based on system resources

### Sampling Strategies

1. **Strategic Sampling**: Prioritize entry points and critical paths
2. **Weighted Sampling**: Higher probability for frequently accessed files
3. **Random Sampling**: Uniform distribution for general analysis
4. **Adaptive Sampling**: Adjust sampling rate based on analysis goals

This design provides a comprehensive foundation for implementing the Old-Tree MCP server with production-grade performance, reliability, and maintainability.