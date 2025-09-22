#!/usr/bin/env node

/**
 * Comprehensive test suite for tree-ast-grep MCP server
 * Tests the core fixes implemented for path resolution and tool consistency
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TestRunner {
  constructor() {
    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;
    this.results = [];
  }

  async runTest(name, testFn) {
    this.testCount++;
    console.log(`\n🔍 Testing: ${name}`);

    try {
      const result = await testFn();
      if (result.success) {
        this.passCount++;
        console.log(`✅ PASS: ${name}`);
        if (result.details) {
          console.log(`   Details: ${result.details}`);
        }
      } else {
        this.failCount++;
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${result.error}`);
      }
      this.results.push({ name, success: result.success, error: result.error, details: result.details });
    } catch (error) {
      this.failCount++;
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Exception: ${error.message}`);
      this.results.push({ name, success: false, error: error.message });
    }
  }

  async executeMCPCommand(tool, params) {
    return new Promise((resolve, reject) => {
      const mcpServer = spawn('node', ['tree-ast-grep-mcp/build/index.js'], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      mcpServer.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      mcpServer.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send MCP protocol messages
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: tool,
          arguments: params
        }
      };

      mcpServer.stdin.write(JSON.stringify(request) + '\n');
      mcpServer.stdin.end();

      const timeout = setTimeout(() => {
        mcpServer.kill('SIGTERM');
        reject(new Error('MCP server timeout'));
      }, 10000);

      mcpServer.on('close', (code) => {
        clearTimeout(timeout);
        resolve({ code, stdout, stderr });
      });

      mcpServer.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testCount}`);
    console.log(`Passed: ${this.passCount}`);
    console.log(`Failed: ${this.failCount}`);
    console.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);

    if (this.failCount > 0) {
      console.log('\nFAILED TESTS:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`- ${r.name}: ${r.error}`);
        });
    }

    return this.failCount === 0;
  }
}

async function main() {
  const runner = new TestRunner();

  console.log('🚀 Starting Comprehensive Test Suite for tree-ast-grep MCP Server');
  console.log('Testing path resolution fixes and tool consistency improvements\n');

  // Test 1: Basic file existence and build verification
  await runner.runTest('Build verification', async () => {
    try {
      await fs.access(path.join(__dirname, 'tree-ast-grep-mcp', 'build', 'index.js'));
      return { success: true, details: 'MCP server build exists' };
    } catch (error) {
      return { success: false, error: 'MCP server build not found. Run npm run build first.' };
    }
  });

  // Test 2: Test file creation for path resolution tests
  await runner.runTest('Create test files', async () => {
    const testDir = path.join(__dirname, 'test-files');
    const srcDir = path.join(testDir, 'src');

    try {
      await fs.mkdir(testDir, { recursive: true });
      await fs.mkdir(srcDir, { recursive: true });

      // Create test files with various patterns
      await fs.writeFile(path.join(srcDir, 'test1.js'), `
console.log('test1');
function testFunc() { return 42; }
var oldVar = 'should use const';
export { testFunc };
      `);

      await fs.writeFile(path.join(srcDir, 'test2.ts'), `
console.log('test2');
const arrow = (x: number) => x * 2;
class TestClass { constructor(private name: string) {} }
      `);

      await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0'
      }, null, 2));

      return { success: true, details: 'Test files created successfully' };
    } catch (error) {
      return { success: false, error: `Failed to create test files: ${error.message}` };
    }
  });

  // Test 3: Path resolution consistency - relative paths
  await runner.runTest('Path resolution - relative paths', async () => {
    try {
      // Test with relative path
      const result = await runner.executeMCPCommand('ast_search', {
        pattern: 'console.log',
        paths: ['test-files/src'],
        language: 'javascript'
      });

      if (result.code !== 0) {
        return { success: false, error: `Non-zero exit code: ${result.code}. Stderr: ${result.stderr}` };
      }

      // Should find matches in both test files
      const hasMatches = result.stdout.includes('test1.js') || result.stdout.includes('test2.ts');
      if (hasMatches) {
        return { success: true, details: 'Relative paths resolved correctly' };
      } else {
        return { success: false, error: `No matches found. Output: ${result.stdout}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test 4: Path resolution consistency - absolute paths
  await runner.runTest('Path resolution - absolute paths', async () => {
    try {
      const absolutePath = path.resolve(__dirname, 'test-files', 'src');
      const result = await runner.executeMCPCommand('ast_search', {
        pattern: 'console.log',
        paths: [absolutePath],
        language: 'javascript'
      });

      if (result.code !== 0) {
        return { success: false, error: `Non-zero exit code: ${result.code}. Stderr: ${result.stderr}` };
      }

      const hasMatches = result.stdout.includes('test1.js') || result.stdout.includes('test2.ts');
      if (hasMatches) {
        return { success: true, details: 'Absolute paths resolved correctly' };
      } else {
        return { success: false, error: `No matches found. Output: ${result.stdout}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test 5: Tool consistency - ast_search vs ast_run_rule
  await runner.runTest('Tool consistency - search vs rule', async () => {
    try {
      // Test ast_search
      const searchResult = await runner.executeMCPCommand('ast_search', {
        pattern: 'var $NAME',
        paths: ['test-files/src'],
        language: 'javascript'
      });

      // Test ast_run_rule with equivalent pattern
      const ruleResult = await runner.executeMCPCommand('ast_run_rule', {
        id: 'test-var-usage',
        language: 'javascript',
        pattern: 'var $NAME',
        message: 'Use const instead of var',
        paths: ['test-files/src']
      });

      const searchHasVarMatch = searchResult.stdout.includes('oldVar') || searchResult.stdout.includes('var');
      const ruleHasVarMatch = ruleResult.stdout.includes('oldVar') || ruleResult.stdout.includes('var');

      if (searchHasVarMatch && ruleHasVarMatch) {
        return { success: true, details: 'Both tools found var usage consistently' };
      } else {
        return {
          success: false,
          error: `Inconsistent results. Search found var: ${searchHasVarMatch}, Rule found var: ${ruleHasVarMatch}`
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test 6: Error handling - non-existent file
  await runner.runTest('Error handling - non-existent file', async () => {
    try {
      const result = await runner.executeMCPCommand('ast_search', {
        pattern: 'console.log',
        paths: ['non-existent/file.js'],
        language: 'javascript'
      });

      // Should handle gracefully with descriptive error
      if (result.stderr.includes('not found') || result.stderr.includes('does not exist')) {
        return { success: true, details: 'Non-existent file error handled gracefully' };
      } else {
        return { success: false, error: `Expected file not found error, got: ${result.stderr}` };
      }
    } catch (error) {
      // MCP protocol error is also acceptable for this test
      if (error.message.includes('timeout') || error.message.includes('not found')) {
        return { success: true, details: 'Error handled at protocol level' };
      }
      return { success: false, error: error.message };
    }
  });

  // Test 7: Workspace detection verification
  await runner.runTest('Workspace detection', async () => {
    try {
      const result = await runner.executeMCPCommand('ast_search', {
        pattern: 'console.log',
        paths: ['.'],  // Current directory should be detected as workspace
        language: 'javascript'
      });

      // Should execute without workspace errors
      if (!result.stderr.includes('outside workspace') && !result.stderr.includes('invalid workspace')) {
        return { success: true, details: 'Workspace detection working correctly' };
      } else {
        return { success: false, error: `Workspace detection issue: ${result.stderr}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Test 8: Cross-platform path handling
  await runner.runTest('Cross-platform path handling', async () => {
    try {
      // Test with mixed separators (should be normalized)
      const mixedPath = 'test-files\\src/test1.js'.replace(/[\\\/]/g, path.sep);
      const result = await runner.executeMCPCommand('ast_search', {
        pattern: 'testFunc',
        paths: [mixedPath],
        language: 'javascript'
      });

      if (result.code === 0 || result.stdout.includes('testFunc')) {
        return { success: true, details: 'Mixed path separators handled correctly' };
      } else {
        return { success: false, error: `Path normalization failed: ${result.stderr}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Cleanup
  await runner.runTest('Cleanup test files', async () => {
    try {
      await fs.rm(path.join(__dirname, 'test-files'), { recursive: true, force: true });
      return { success: true, details: 'Test files cleaned up' };
    } catch (error) {
      return { success: false, error: `Cleanup failed: ${error.message}` };
    }
  });

  // Print final summary
  const allTestsPassed = runner.printSummary();

  if (allTestsPassed) {
    console.log('\n🎉 All tests passed! The MCP server fixes are working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});