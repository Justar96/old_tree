/**
 * End-to-End tests for complete workflows
 */

import { spawn } from 'child_process';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function runEndToEndTests() {
  const suite = new TestSuite('End-to-End Tests');

  let tempDir;

  suite.beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-e2e-'));
  });

  suite.afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  suite.test('should complete search -> replace workflow', async () => {
    // Create test file
    const testFile = path.join(tempDir, 'workflow-test.js');
    const originalContent = `
function greet(name) {
  console.log("Hello, " + name);
}

function farewell(name) {
  console.log("Goodbye, " + name);
}

console.log("Starting application");
`;

    await fs.writeFile(testFile, originalContent);

    try {
      // Step 1: Search for console.log patterns
      const searchResult = await performMCPCall('search', {
        pattern: 'console.log($ARG)',
        language: 'javascript',
        paths: [testFile]
      });

      TestAssert.assertTrue(typeof searchResult === 'object');

      // Step 2: Replace console.log with logger.info
      const replaceResult = await performMCPCall('replace', {
        pattern: 'console.log($ARG)',
        replacement: 'logger.info($ARG)',
        language: 'javascript',
        paths: [testFile]
      });

      TestAssert.assertTrue(typeof replaceResult === 'object');

      // Step 3: Verify changes were made
      const modifiedContent = await fs.readFile(testFile, 'utf8');
      TestAssert.assertContains(modifiedContent, 'logger.info');
      TestAssert.assertNotContains(modifiedContent, 'console.log');

    } catch (error) {
      if (error.message.includes('build not found') ||
          error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping workflow test - dependencies not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should complete scan -> fix workflow', async () => {
    const testFile = path.join(tempDir, 'scan-fix-test.js');
    const testContent = `
function oldStyleFunction(param) {
  if (param == null) {
    return false;
  }
  return true;
}

function anotherOldStyleFunction(a, b) {
  if (a == b) {
    return true;
  }
  return false;
}
`;

    await fs.writeFile(testFile, testContent);

    try {
      // Step 1: Scan for equality operators
      const scanRule = `
rule:
  pattern: $A == $B
  language: javascript
message: "Use strict equality (===) instead of loose equality (==)"
severity: warning
`;

      const scanResult = await performMCPCall('scan', {
        rule: scanRule,
        paths: [testFile]
      });

      TestAssert.assertTrue(typeof scanResult === 'object');

      // Step 2: Fix the issues
      const fixResult = await performMCPCall('replace', {
        pattern: '$A == $B',
        replacement: '$A === $B',
        language: 'javascript',
        paths: [testFile]
      });

      TestAssert.assertTrue(typeof fixResult === 'object');

      // Step 3: Verify fixes
      const fixedContent = await fs.readFile(testFile, 'utf8');
      TestAssert.assertContains(fixedContent, '===');
      TestAssert.assertNotContains(fixedContent, ' == ');

    } catch (error) {
      if (error.message.includes('build not found') ||
          error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping scan-fix test - dependencies not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle large codebase operations', async () => {
    // Create multiple test files
    const files = [];

    for (let i = 0; i < 5; i++) {
      const fileName = path.join(tempDir, `large-test-${i}.js`);
      const content = `
// File ${i}
function processData${i}(data) {
  console.log("Processing data in file ${i}");
  if (data != null) {
    return data.map(item => item * ${i});
  }
  return [];
}

class Handler${i} {
  constructor() {
    console.log("Handler ${i} created");
  }
}
`;

      await fs.writeFile(fileName, content);
      files.push(fileName);
    }

    try {
      // Search across all files
      const searchResult = await performMCPCall('search', {
        pattern: 'console.log($MSG)',
        language: 'javascript',
        paths: files
      });

      TestAssert.assertTrue(typeof searchResult === 'object');

      // Replace across all files
      const replaceResult = await performMCPCall('replace', {
        pattern: 'console.log($MSG)',
        replacement: 'logger.debug($MSG)',
        language: 'javascript',
        paths: files
      });

      TestAssert.assertTrue(typeof replaceResult === 'object');

      // Verify all files were processed
      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        TestAssert.assertContains(content, 'logger.debug');
        TestAssert.assertNotContains(content, 'console.log');
      }

    } catch (error) {
      if (error.message.includes('build not found') ||
          error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping large codebase test - dependencies not available');
        return;
      }
      throw error;
    }
  });

  // Helper function to perform MCP calls
  async function performMCPCall(toolName, params) {
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', ['../../build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
      });

      let result = '';
      let initialized = false;

      const timeout = setTimeout(() => {
        serverProcess.kill();
        reject(new Error(`MCP call to ${toolName} timed out`));
      }, 15000);

      serverProcess.stdout.on('data', (data) => {
        const response = data.toString();
        result += response;

        if (!initialized && response.includes('result')) {
          initialized = true;
          // Send tool call
          const toolCallMessage = JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: params
            }
          }) + '\n';

          serverProcess.stdin.write(toolCallMessage);
        } else if (initialized && (response.includes('result') || response.includes('error'))) {
          clearTimeout(timeout);
          serverProcess.kill();

          try {
            const lines = result.split('\n').filter(line => line.trim());
            const lastLine = lines[lines.length - 1] || lines[lines.length - 2];
            const parsed = JSON.parse(lastLine);

            if (parsed.error) {
              reject(new Error(parsed.error.message || 'MCP call failed'));
            } else {
              resolve(parsed.result);
            }
          } catch (parseError) {
            resolve({ success: true, rawResponse: result });
          }
        }
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Initialize server
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          clientInfo: { name: 'e2e-test', version: '1.0.0' }
        }
      }) + '\n';

      serverProcess.stdin.write(initMessage);
    });
  }

  return suite.run();
}