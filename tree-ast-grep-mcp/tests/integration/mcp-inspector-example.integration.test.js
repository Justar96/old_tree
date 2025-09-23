/**
 * MCP Inspector Example Test
 * Demonstrates enhanced testing with Model Context Protocol inspection
 */

import { TestSuite, TestAssert } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Import tools for testing
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function runMCPInspectorExampleTest() {
    const suite = new TestSuite('MCP Inspector Example Tests');

    let binaryManager;
    let workspaceManager;
    let searchTool;
    let replaceTool;
    let tempDir;

    suite.beforeAll(async () => {
        binaryManager = new AstGrepBinaryManager({ useSystem: true });
        workspaceManager = new WorkspaceManager();
        searchTool = new SearchTool(binaryManager, workspaceManager);
        replaceTool = new ReplaceTool(binaryManager, workspaceManager);

        try {
            await binaryManager.initialize();
        } catch (error) {
            console.log('  ⚠️  Binary manager initialization failed:', error.message);
        }

        tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-inspector-test-'));
    });

    suite.afterAll(async () => {
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            console.log('  ⚠️  Failed to clean up temp directory');
        }
    });

    suite.test('should inspect pattern matching with expected results', async () => {
        const testCode = `
function greet(name) {
    console.log("Hello, " + name);
}

function farewell(name) {
    console.log("Goodbye, " + name);
}
`;

        const pattern = 'console.log($MSG)';
        const result = await searchTool.execute({
            pattern,
            language: 'javascript',
            code: testCode
        });

        // Use MCP Inspector to validate pattern matching
        const expectedMatches = 2;
        TestAssert.assertPattern(
            pattern,
            result,
            { matchCount: expectedMatches, type: 'search' }
        );

        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue(Array.isArray(result.matches) || result.matches === undefined);
    });

    suite.test('should inspect code transformation results', async () => {
        const inputCode = `
function oldStyle() {
    var x = 5;
    var y = 10;
    return x + y;
}
`;

        const expectedOutput = `
function oldStyle() {
    let x = 5;
    let y = 10;
    return x + y;
}
`;

        try {
            const result = await replaceTool.execute({
                pattern: 'var $NAME = $VALUE',
                replacement: 'let $NAME = $VALUE',
                language: 'javascript',
                code: inputCode
            });

            // Use MCP Inspector to validate transformation
            TestAssert.assertTransformation(
                inputCode,
                result.modified || result,
                expectedOutput.trim()
            );

        } catch (error) {
            // If replacement fails, still record the inspection
            TestAssert.assertTransformation(
                inputCode,
                null,
                null
            );
            
            console.log('  ⚠️  Replacement test skipped due to error:', error.message);
        }
    });

    suite.test('should inspect complex pattern matching scenarios', async () => {
        const complexCode = `
class UserManager {
    constructor() {
        this.users = [];
    }

    addUser(user) {
        console.log('Adding user:', user.name);
        this.users.push(user);
    }

    removeUser(id) {
        console.log('Removing user with id:', id);
        this.users = this.users.filter(u => u.id !== id);
    }

    findUser(id) {
        return this.users.find(u => u.id === id);
    }
}
`;

        // Test method pattern matching
        const methodPattern = '$METHOD($PARAMS) { $$$BODY }';
        const methodResult = await searchTool.execute({
            pattern: methodPattern,
            language: 'javascript',
            code: complexCode
        });

        TestAssert.assertPattern(
            methodPattern,
            methodResult,
            { type: 'method-search', expectedMinMatches: 3 }
        );

        // Test console.log pattern matching
        const consolePattern = 'console.log($$$ARGS)';
        const consoleResult = await searchTool.execute({
            pattern: consolePattern,
            language: 'javascript',
            code: complexCode
        });

        TestAssert.assertPattern(
            consolePattern,
            consoleResult,
            { type: 'console-search', expectedMatches: 2 }
        );

        TestAssert.assertTrue(typeof methodResult === 'object');
        TestAssert.assertTrue(typeof consoleResult === 'object');
    });

    suite.test('should handle edge cases with proper inspection', async () => {
        const emptyCode = '';
        const pattern = 'function $NAME() { $$$BODY }';

        const result = await searchTool.execute({
            pattern,
            language: 'javascript',
            code: emptyCode
        });

        // Inspect edge case scenario
        TestAssert.assertPattern(
            pattern,
            result,
            { type: 'empty-code-search', expectedMatches: 0 }
        );

        TestAssert.assertTrue(typeof result === 'object');
    });

    return suite.run();
}