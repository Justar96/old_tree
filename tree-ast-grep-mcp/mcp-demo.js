#!/usr/bin/env node

/**
 * MCP Inspector Demo Script
 * Demonstrates the enhanced testing capabilities with Model Context Protocol integration
 */

import { TestSuite, TestAssert } from './tests/utils/test-helpers.js';
import { promises as fs } from 'fs';

async function runMCPDemo() {
    console.log('🚀 MCP Inspector Integration Demo\n');

    const suite = new TestSuite('MCP Demo Suite');

    suite.test('should demonstrate pattern inspection', async () => {
        const testCode = `
function greet(name) {
    console.log("Hello, " + name);
}

function farewell(name) {
    console.log("Goodbye, " + name);
}
`;

        const pattern = 'console.log($MSG)';
        const mockResult = {
            matches: [
                { pattern: 'console.log("Hello, " + name)', line: 3 },
                { pattern: 'console.log("Goodbye, " + name)', line: 7 }
            ]
        };

        // Use MCP Inspector to validate pattern matching
        TestAssert.assertPattern(
            pattern,
            mockResult,
            { matchCount: 2, type: 'search' }
        );

        console.log('  ✅ Pattern inspection completed');
    });

    suite.test('should demonstrate transformation inspection', async () => {
        const inputCode = `var x = 5; var y = 10;`;
        const outputCode = `let x = 5; let y = 10;`;

        // Use MCP Inspector to validate transformation
        TestAssert.assertTransformation(
            inputCode,
            outputCode,
            `let x = 5; let y = 10;`
        );

        console.log('  ✅ Transformation inspection completed');
    });

    suite.test('should demonstrate edge case inspection', async () => {
        const pattern = 'function $NAME() { $$$BODY }';
        const emptyResult = { matches: [] };

        TestAssert.assertPattern(
            pattern,
            emptyResult,
            { type: 'empty-search', expectedMatches: 0 }
        );

        console.log('  ✅ Edge case inspection completed');
    });

    const results = await suite.run();

    console.log('\n🔍 MCP Inspector Results:');
    console.log('=====================================');
    
    if (results.inspectionResults) {
        const inspections = results.inspectionResults.results;
        console.log(`Total inspections: ${inspections.length}`);
        
        inspections.forEach((inspection, index) => {
            console.log(`\n${index + 1}. ${inspection.type.toUpperCase()} Inspection:`);
            console.log(`   Pattern: ${inspection.pattern || 'N/A'}`);
            console.log(`   Status: ${inspection.passed ? '✅ PASSED' : '❌ FAILED'}`);
            console.log(`   Timestamp: ${inspection.timestamp}`);
        });
    }

    // Generate MCP report
    const mcpReport = {
        version: '1.0',
        type: 'mcp.demo-report',
        timestamp: new Date().toISOString(),
        summary: {
            totalTests: results.total,
            passedTests: results.passed,
            failedTests: results.failed,
            successRate: results.total > 0 ? (results.passed / results.total * 100).toFixed(2) : 0
        },
        inspectionResults: results.inspectionResults,
        metadata: {
            demo: true,
            runner: 'mcp-demo-script',
            nodeVersion: process.version,
            platform: process.platform
        }
    };

    await fs.writeFile('mcp-demo-report.json', JSON.stringify(mcpReport, null, 2));
    console.log('\n📋 Demo report saved to: mcp-demo-report.json');

    console.log('\n🎉 MCP Inspector Demo completed successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Pattern matching inspection with validation');
    console.log('• Code transformation inspection and verification');
    console.log('• Edge case handling with proper inspection');
    console.log('• Structured MCP-compliant reporting');
    console.log('• Real-world agent usage simulation');

    return results.failed === 0;
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMCPDemo()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Demo failed:', error);
            process.exit(1);
        });
}

export default runMCPDemo;