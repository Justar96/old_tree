# Requirements Document

## Introduction

Old-Tree is a Model Context Protocol (MCP) server that delivers sub-500ms legacy codebase analysis through pure AST parsing. Unlike vector-based solutions, it provides deterministic, reproducible structural analysis for AI agents working with undocumented legacy systems.

**Core Value Proposition**: Enable AI agents to understand legacy codebase architecture instantly without preprocessing delays or vector embedding overhead.

**Primary Use Cases**:
- Legacy system modernization planning
- Impact analysis for code changes
- Dependency mapping for refactoring
- Security vulnerability assessment
- Technical debt quantification

**Success Metrics**:
- Analysis speed: <500ms for codebases up to 100k LOC
- Accuracy: 95%+ entity extraction precision
- Coverage: Support for 4 legacy languages (COBOL, FORTRAN, Java, PHP)
- Reliability: 99.9% uptime with graceful error handling

## Requirements

### Requirement 1: Core Performance & Architecture

**User Story:** As an AI agent, I need instant codebase structure analysis to make real-time decisions about legacy system modifications without preprocessing delays.

**Business Impact**: Reduces legacy system analysis time from hours to seconds, enabling rapid modernization decisions.

#### Acceptance Criteria

1. **Performance Targets**:
   - WHEN analyzing ≤10k LOC THEN respond in <100ms (95th percentile)
   - WHEN analyzing ≤50k LOC THEN respond in <300ms (95th percentile)  
   - WHEN analyzing ≤100k LOC THEN respond in <500ms (95th percentile)
   - WHEN memory usage exceeds 1GB THEN trigger automatic optimization

2. **Unified Interface**:
   - WHEN processing any supported language THEN use identical MCP tool signatures
   - WHEN switching languages THEN maintain consistent output schema
   - WHEN errors occur THEN return standardized error format across languages

3. **Deterministic Analysis**:
   - WHEN analyzing identical code twice THEN return byte-identical results
   - WHEN running on different systems THEN produce consistent entity extraction
   - WHEN using different AST implementations THEN maintain result compatibility

### Requirement 2: Hierarchical Structure Analysis (create_tree tool)

**User Story:** As an AI agent analyzing legacy systems, I need configurable depth analysis to balance speed vs. detail based on my specific modernization task.

**Business Impact**: Enables progressive disclosure - quick overview for planning, deep analysis for implementation.

#### Acceptance Criteria

1. **Tool Interface**:
   - WHEN calling create_tree THEN accept: workspace_path (required), profile (optional, default: 'balanced'), include_patterns (optional), exclude_patterns (optional)
   - WHEN workspace_path is invalid THEN return clear error with suggested corrections
   - WHEN patterns conflict THEN prioritize exclude_patterns over include_patterns

2. **Profile Performance Guarantees**:
   - WHEN using 'quick' profile THEN complete in <5s for ≤1k files, depth ≤3, 30% sampling
   - WHEN using 'balanced' profile THEN complete in <30s for ≤10k files, depth ≤5, 60% sampling
   - WHEN using 'deep' profile THEN complete in <300s for ≤100k files, depth ≤10, no sampling
   - WHEN profile limits exceeded THEN auto-downgrade with warning

3. **Entity Extraction Precision**:
   - WHEN extracting functions THEN achieve ≥95% precision, ≥90% recall
   - WHEN extracting classes/modules THEN capture inheritance and composition relationships
   - WHEN extracting imports/exports THEN resolve relative paths to absolute
   - WHEN extracting database queries THEN identify SQL strings and ORM calls
   - WHEN extracting API endpoints THEN capture HTTP methods and route patterns

4. **Metrics Calculation**:
   - WHEN calculating complexity THEN use McCabe cyclomatic complexity
   - WHEN calculating coupling THEN measure afferent/efferent coupling ratios
   - WHEN calculating cohesion THEN use LCOM (Lack of Cohesion of Methods)
   - WHEN detecting duplication THEN identify code blocks ≥6 lines with ≥80% similarity
   - WHEN assessing tech debt THEN score based on complexity, duplication, and comment ratio

### Requirement 3: Dependency Analysis & Impact Assessment (find_branch tool)

**User Story:** As an AI agent planning legacy system changes, I need precise impact analysis to identify all affected components before making modifications.

**Business Impact**: Prevents breaking changes by revealing hidden dependencies, reducing production incidents by 80%.

#### Acceptance Criteria

1. **Tool Interface**:
   - WHEN calling find_branch THEN accept: target (required), analysis_type (default: 'dependencies'), max_depth (default: 5), include_tests (default: false)
   - WHEN target is ambiguous THEN return disambiguation options with confidence scores
   - WHEN analysis_type is invalid THEN suggest valid options: 'dependencies', 'dependents', 'impact', 'lineage'

2. **Dependency Tracking Accuracy**:
   - WHEN tracking imports THEN resolve dynamic imports and conditional requires
   - WHEN tracking function calls THEN identify direct calls, callbacks, and event handlers
   - WHEN tracking inheritance THEN map class hierarchies and interface implementations
   - WHEN tracking data flow THEN identify variable assignments and parameter passing
   - WHEN tracking side effects THEN detect file I/O, database calls, and global state changes

3. **Advanced Analysis Capabilities**:
   - WHEN detecting dead code THEN identify unreachable functions with ≥95% accuracy
   - WHEN finding circular dependencies THEN detect cycles at module and function levels
   - WHEN scanning vulnerabilities THEN identify SQL injection, XSS, and buffer overflow patterns
   - WHEN analyzing performance THEN flag O(n²) algorithms and inefficient database queries

4. **Traversal & Filtering**:
   - WHEN using BFS traversal THEN prioritize breadth for impact analysis
   - WHEN using DFS traversal THEN prioritize depth for lineage tracing
   - WHEN setting boundaries THEN respect node_modules, vendor, and test directory exclusions
   - WHEN filtering results THEN support regex patterns for file paths and entity names

5. **Output Quality**:
   - WHEN returning results THEN include confidence scores for each relationship
   - WHEN generating visualization THEN provide Mermaid-compatible graph data
   - WHEN summarizing impact THEN quantify affected LOC, files, and modules

### Requirement 4: Intelligent Caching & Performance Optimization

**User Story:** As an AI agent working iteratively on legacy systems, I need cached results for unchanged code to maintain sub-second response times across multiple analysis requests.

**Business Impact**: Enables real-time iterative analysis workflows, reducing repeated analysis overhead by 90%.

#### Acceptance Criteria

1. **Multi-Level Caching**:
   - WHEN file unchanged THEN use cached AST (target: 95% cache hit rate)
   - WHEN function unchanged THEN use cached metrics and relationships
   - WHEN module unchanged THEN use cached dependency graph
   - WHEN workspace unchanged THEN use cached full analysis results

2. **Cache Performance**:
   - WHEN checking file changes THEN use XXHash64 fingerprinting in <1ms
   - WHEN cache hit occurs THEN respond in <50ms (90th percentile)
   - WHEN cache miss occurs THEN update cache asynchronously after response
   - WHEN memory pressure detected THEN evict LRU entries maintaining 80% hit rate

3. **Incremental Parsing**:
   - WHEN file partially changed THEN reparse only affected AST nodes
   - WHEN dependency added/removed THEN update only affected graph edges
   - WHEN function modified THEN recalculate only dependent metrics
   - WHEN import changed THEN invalidate only downstream caches

4. **Cache Management**:
   - WHEN cache size exceeds 500MB THEN trigger automatic cleanup
   - WHEN file deleted THEN remove all associated cache entries
   - WHEN workspace switched THEN isolate cache namespaces
   - WHEN system restart THEN persist critical cache entries to disk

### Requirement 5: Robust Error Handling & Recovery

**User Story:** As an AI agent analyzing diverse legacy codebases, I need reliable partial results even when encountering malformed code, unsupported syntax, or system constraints.

**Business Impact**: Ensures 99.9% analysis completion rate despite code quality issues, enabling analysis of even poorly maintained legacy systems.

#### Acceptance Criteria

1. **Parse Error Recovery**:
   - WHEN syntax error encountered THEN attempt recovery using error-tolerant parsing
   - WHEN recovery fails THEN extract partial AST from valid sections
   - WHEN file completely unparseable THEN include file in results with error metadata
   - WHEN parse errors exceed 20% of files THEN suggest language detection review

2. **Implementation Fallback Chain**:
   - WHEN @ast-grep/napi fails THEN automatically fallback to @ast-grep/wasm
   - WHEN WASM fails THEN fallback to ast-grep CLI binary
   - WHEN all implementations fail THEN use regex-based entity extraction
   - WHEN fallback used THEN include implementation info in response metadata

3. **Resource Constraint Handling**:
   - WHEN analysis exceeds timeout THEN return partial results with completion percentage
   - WHEN file exceeds size limit (5MB) THEN skip with warning, continue processing
   - WHEN memory usage exceeds 1GB THEN enable aggressive sampling and cleanup
   - WHEN disk space low THEN disable caching, continue with in-memory processing

4. **Error Reporting & Continuity**:
   - WHEN errors occur THEN include error summary in response without failing request
   - WHEN unsupported syntax found THEN log for future language support improvements
   - WHEN system resources constrained THEN provide optimization recommendations
   - WHEN critical errors occur THEN maintain service availability with degraded functionality

### Requirement 6: Multi-Language Legacy Support

**User Story:** As an AI agent working with diverse legacy systems, I need accurate language-specific entity extraction that understands the unique patterns and structures of each legacy language.

**Business Impact**: Enables comprehensive legacy system analysis across technology stacks, supporting modernization of mixed-language environments.

#### Acceptance Criteria

1. **COBOL Analysis (Priority: High)**:
   - WHEN analyzing COBOL THEN extract PROGRAM-ID, PROCEDURE DIVISION, DATA DIVISION structures
   - WHEN finding PERFORM statements THEN map control flow and called paragraphs
   - WHEN processing COPY statements THEN resolve copybook dependencies
   - WHEN analyzing data items THEN extract PIC clauses and data relationships
   - WHEN detecting file operations THEN identify FD, SELECT, and I/O statements

2. **Java Analysis (Priority: High)**:
   - WHEN analyzing Java THEN extract classes, interfaces, enums with full signatures
   - WHEN processing methods THEN capture visibility, parameters, return types, exceptions
   - WHEN finding annotations THEN extract annotation types and parameters
   - WHEN analyzing imports THEN resolve package dependencies and static imports
   - WHEN detecting Spring/JEE patterns THEN identify beans, controllers, services

3. **FORTRAN Analysis (Priority: Medium)**:
   - WHEN analyzing FORTRAN THEN extract PROGRAM, SUBROUTINE, FUNCTION definitions
   - WHEN processing modules THEN capture USE statements and module dependencies
   - WHEN finding INCLUDE statements THEN resolve include file dependencies
   - WHEN analyzing COMMON blocks THEN identify shared variable declarations
   - WHEN detecting I/O operations THEN identify READ, WRITE, and file operations

4. **PHP Analysis (Priority: Medium)**:
   - WHEN analyzing PHP THEN extract classes, functions, traits with visibility modifiers
   - WHEN processing includes THEN resolve require/include dependencies
   - WHEN finding namespaces THEN map namespace hierarchies and use statements
   - WHEN analyzing variables THEN identify global, static, and class properties
   - WHEN detecting framework patterns THEN identify MVC structures and database models

5. **Language Detection & Mixed Codebases**:
   - WHEN language='auto' THEN detect primary language by file count and LOC
   - WHEN multiple languages present THEN analyze each with appropriate processor
   - WHEN language detection uncertain THEN provide confidence scores for each detected language
   - WHEN unsupported language found THEN gracefully skip with informative warning

### Requirement 7: Adaptive Analysis Profiles

**User Story:** As an AI agent with varying analysis needs, I want intelligent profile selection that automatically optimizes for my specific use case while respecting system constraints.

**Business Impact**: Maximizes analysis value within time/resource constraints, enabling both rapid exploration and detailed investigation workflows.

#### Acceptance Criteria

1. **Profile Auto-Selection**:
   - WHEN no profile specified THEN auto-select based on workspace size and system resources
   - WHEN workspace <1k files THEN recommend 'quick' profile
   - WHEN workspace 1k-10k files THEN recommend 'balanced' profile  
   - WHEN workspace >10k files THEN recommend 'deep' profile with sampling

2. **Quick Profile (Exploration)**:
   - WHEN using 'quick' THEN limit: depth=3, files=1k, size=100KB, workers=4, timeout=5s, sampling=30%
   - WHEN quick profile selected THEN prioritize entry points and main modules
   - WHEN sampling enabled THEN use strategic sampling focusing on critical paths
   - WHEN timeout approaching THEN return partial results with completion status

3. **Balanced Profile (Standard Analysis)**:
   - WHEN using 'balanced' THEN limit: depth=5, files=10k, size=500KB, workers=8, timeout=30s, sampling=60%
   - WHEN balanced profile selected THEN include comprehensive entity extraction
   - WHEN resource constraints detected THEN dynamically adjust parallelism
   - WHEN analysis quality drops THEN suggest profile upgrade

4. **Deep Profile (Comprehensive)**:
   - WHEN using 'deep' THEN limit: depth=10, files=100k, size=5MB, workers=16, timeout=300s, sampling=disabled
   - WHEN deep profile selected THEN enable all advanced analysis features
   - WHEN system resources insufficient THEN provide resource requirement estimates
   - WHEN analysis exceeds limits THEN offer incremental processing options

5. **Custom Profile Validation**:
   - WHEN custom parameters provided THEN validate against system capabilities
   - WHEN invalid configuration detected THEN suggest nearest valid configuration
   - WHEN resource requirements exceed system THEN provide scaling recommendations
   - WHEN profile conflicts with workspace THEN auto-adjust with user notification

### Requirement 8: Production Monitoring & Optimization

**User Story:** As a system administrator deploying Old-Tree in production, I need comprehensive monitoring and automatic optimization to maintain performance SLAs and troubleshoot issues proactively.

**Business Impact**: Ensures consistent performance and reliability in production environments, reducing support overhead and improving user experience.

#### Acceptance Criteria

1. **Performance Metrics Collection**:
   - WHEN processing requests THEN track: response time (p50, p95, p99), memory usage, CPU utilization, cache hit rates
   - WHEN analysis completes THEN record: files processed, entities extracted, errors encountered, profile used
   - WHEN caching events occur THEN track: cache hits/misses, eviction rates, memory pressure events
   - WHEN resource limits hit THEN log: constraint type, impact on analysis, mitigation actions taken

2. **Error Monitoring & Alerting**:
   - WHEN errors occur THEN log: error type, affected files, stack trace, recovery actions, user impact
   - WHEN error rate exceeds 5% THEN trigger alert with error pattern analysis
   - WHEN critical errors occur THEN immediately notify administrators with context
   - WHEN error patterns detected THEN suggest configuration or code improvements

3. **Usage Analytics & Optimization**:
   - WHEN tools called THEN track: tool usage frequency, parameter patterns, success rates
   - WHEN performance targets missed THEN analyze: bottlenecks, resource constraints, optimization opportunities
   - WHEN usage patterns change THEN adapt: cache sizes, worker allocation, profile recommendations
   - WHEN system resources change THEN automatically adjust: parallelism, memory limits, timeout values

4. **Health Checks & Diagnostics**:
   - WHEN health check requested THEN verify: AST implementations, cache functionality, worker threads, memory usage
   - WHEN system degradation detected THEN provide: diagnostic information, recommended actions, impact assessment
   - WHEN maintenance required THEN schedule: cache cleanup, log rotation, performance optimization
   - WHEN capacity planning needed THEN provide: usage trends, resource projections, scaling recommendations

### Requirement 9: MCP Protocol Compliance & Integration

**User Story:** As an AI agent using MCP clients (Claude Desktop, Kiro, custom implementations), I need seamless integration with standardized tool discovery, parameter validation, and response formatting.

**Business Impact**: Ensures compatibility across all MCP clients, enabling widespread adoption and integration into existing AI workflows.

#### Acceptance Criteria

1. **MCP Protocol Compliance**:
   - WHEN client connects THEN respond to initialize with server capabilities and version
   - WHEN tools/list requested THEN return complete tool schemas with parameter descriptions
   - WHEN tools/call invoked THEN validate parameters and return structured responses
   - WHEN protocol errors occur THEN return standard MCP error responses with helpful messages

2. **Tool Schema Definition**:
   - WHEN defining create_tree tool THEN provide comprehensive parameter schema with examples
   - WHEN defining find_branch tool THEN include parameter validation rules and constraints
   - WHEN parameters invalid THEN return specific validation errors with correction suggestions
   - WHEN optional parameters omitted THEN apply intelligent defaults based on workspace context

3. **Response Format Standardization**:
   - WHEN returning analysis results THEN use consistent JSON schema across all tools
   - WHEN including metadata THEN provide standard fields: timestamp, version, performance_metrics
   - WHEN errors occur THEN include error_code, message, details, and suggested_actions
   - WHEN partial results returned THEN clearly indicate completion_status and missing_data

4. **Client Compatibility**:
   - WHEN used with Claude Desktop THEN ensure seamless tool integration and response rendering
   - WHEN used with Kiro THEN support real-time analysis workflows and caching
   - WHEN used with custom clients THEN provide comprehensive API documentation and examples
   - WHEN client capabilities vary THEN adapt response format while maintaining core functionality