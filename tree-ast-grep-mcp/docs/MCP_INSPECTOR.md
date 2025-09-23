# MCP Inspector Integration

This document explains how the tree-ast-grep-mcp project has been enhanced with Model Context Protocol (MCP) Inspector capabilities for better testing and real-world agent usage alignment.

## Overview

The MCP Inspector integration provides:
- Enhanced test assertions with pattern and transformation inspection
- Structured test result reporting in MCP format
- Real-world usage simulation for AI agents
- Detailed inspection results for debugging and validation

## Architecture

### Core Components

1. **MCPInspector** (`tests/utils/mcp-inspector.js`)
   - Records inspection results for patterns and transformations
   - Provides structured data in MCP format
   - Tracks pass/fail status for each inspection

2. **MCPTestAssert** (`tests/utils/mcp-inspector.js`)
   - Enhanced assertion methods with MCP inspection
   - Inherits all standard assertion methods
   - Adds `assertPattern()` and `assertTransformation()` methods

3. **MCPTestRunner** (`tests/mcp-runner.js`)
   - Enhanced test runner with MCP reporting
   - Generates comprehensive test reports in MCP format
   - Supports all existing test categories plus MCP-specific features

### Enhanced Test Helpers

The test helpers have been updated to integrate seamlessly with MCP Inspector:

```javascript
import { TestSuite, TestAssert } from '../utils/test-helpers.js';

// TestAssert now includes MCP inspection capabilities
TestAssert.assertPattern(pattern, result, expected);
TestAssert.assertTransformation(input, output, expected);
```

## Usage

### Running Tests with MCP Inspector

```bash
# Run integration tests with MCP reporting
npm run test:mcp

# Run all tests with MCP reporting
npm run test:mcp-all

# Watch mode with MCP reporting
npm run test:mcp-watch

# Custom MCP runner usage
node tests/mcp-runner.js --integration --mcp-report --mcp-output=custom-report.json
```

### Writing MCP-Enhanced Tests

```javascript
export default async function runMyTests() {
    const suite = new TestSuite('My MCP Enhanced Tests');

    suite.test('should inspect pattern matching', async () => {
        const pattern = 'console.log($MSG)';
        const result = await searchTool.execute({
            pattern,
            language: 'javascript',
            code: testCode
        });

        // MCP Inspector will record this assertion
        TestAssert.assertPattern(pattern, result, {
            matchCount: 2,
            type: 'search'
        });
    });

    suite.test('should inspect code transformation', async () => {
        const result = await replaceTool.execute({
            pattern: 'var $NAME = $VALUE',
            replacement: 'let $NAME = $VALUE',
            language: 'javascript',
            code: inputCode
        });

        // MCP Inspector will record this transformation
        TestAssert.assertTransformation(
            inputCode,
            result.modified,
            expectedOutput
        );
    });

    return suite.run();
}
```

### MCP Report Format

The MCP Inspector generates reports in this structure:

```json
{
    "version": "1.0",
    "type": "mcp.test-report",
    "timestamp": "2025-09-23T...",
    "summary": {
        "totalTests": 15,
        "passedTests": 13,
        "failedTests": 2,
        "successRate": "86.67"
    },
    "suites": [
        {
            "name": "example.test.js",
            "passed": 5,
            "failed": 1,
            "total": 6,
            "inspectionResults": {
                "type": "mcp.inspection",
                "version": "1.0",
                "results": [
                    {
                        "timestamp": "2025-09-23T...",
                        "type": "pattern",
                        "pattern": "console.log($MSG)",
                        "result": {...},
                        "expected": {...},
                        "passed": true
                    }
                ]
            }
        }
    ],
    "inspections": [...],
    "metadata": {
        "runner": "mcp-enhanced-test-runner",
        "nodeVersion": "v18.17.0",
        "platform": "win32",
        "arch": "x64"
    }
}
```

## Benefits for AI Agents

### Real-World Usage Alignment

1. **Pattern Validation**: Tests now validate that patterns work as expected in real scenarios
2. **Transformation Verification**: Code transformations are inspected for correctness
3. **Structured Results**: AI agents can consume structured test results for better decision making
4. **Debugging Support**: Detailed inspection results help debug pattern and transformation issues

### Agent Integration

The MCP Inspector format aligns with Model Context Protocol standards, making it easier for AI agents to:
- Understand test results
- Make decisions based on inspection data
- Integrate with MCP-compatible tools and systems
- Provide better feedback to users

## Migration Guide

### Existing Tests

Existing tests continue to work without changes. To add MCP inspection:

1. Replace standard assertions with MCP-enhanced versions where beneficial
2. Use `assertPattern()` for ast-grep pattern validation
3. Use `assertTransformation()` for code transformation validation

### New Tests

For new tests, consider using MCP Inspector features:

```javascript
// Before (standard assertion)
TestAssert.assertTrue(result.matches.length > 0);

// After (MCP-enhanced assertion)
TestAssert.assertPattern(pattern, result, { 
    expectedMinMatches: 1 
});
```

## Configuration

### Environment Variables

- `MCP_INSPECTOR_ENABLED`: Enable/disable MCP inspection (default: true)
- `MCP_REPORT_FORMAT`: Report format (json|yaml, default: json)
- `MCP_REPORT_LEVEL`: Detail level (basic|detailed, default: detailed)

### Command Line Options

- `--mcp-report`: Enable MCP report generation
- `--mcp-output=<file>`: Specify output file (default: mcp-test-results.json)
- `--verbose`: Show detailed MCP inspection summaries

## Future Enhancements

1. **Real-time MCP Server**: Stream inspection results to MCP-compatible tools
2. **Visual Inspection**: Web-based inspection result viewer
3. **Pattern Library**: Build library of validated patterns from inspection data
4. **Performance Metrics**: Track pattern matching and transformation performance
5. **Integration Tests**: Automated tests with external MCP tools

## Examples

See `tests/integration/mcp-inspector-example.integration.test.js` for comprehensive usage examples demonstrating:
- Pattern matching inspection
- Code transformation validation
- Complex scenario handling
- Edge case inspection
- Structured result validation