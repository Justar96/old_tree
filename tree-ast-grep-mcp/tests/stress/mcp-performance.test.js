/**
 * MCP Performance and Load Testing
 * Following MCP Inspector stress testing patterns
 */

import { spawn } from 'child_process';
import { TestSuite, TestAssert } from '../utils/test-helpers.js';
import { TEST_CONFIG, MCPMessageBuilder, MCPValidator } from '../utils/mcp-test-config.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function runMCPPerformanceTests() {
  const suite = new TestSuite('MCP Performance and Load Tests');

  let tempDir;
  let largeTestFile;
  let messageBuilder;

  suite.beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-performance-test-'));
    messageBuilder = new MCPMessageBuilder();

    // Create large test file for stress testing
    const largeCode = generateLargeCodeFile(1000); // 1000 functions
    largeTestFile = path.join(tempDir, 'large.js');
    await fs.writeFile(largeTestFile, largeCode);
  });

  suite.afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Test server startup time
   */
  suite.test('Server Startup Performance', async () => {
    const startTime = Date.now();
    
    const serverProcess = spawn('node', [path.resolve(__dirname, '../../build/index.js'), '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      // Measure time to first response
      const initResponse = await sendMCPMessage(
        serverProcess, 
        messageBuilder.initialize(),
        TEST_CONFIG.TIMEOUTS.SERVER_START
      );

      const startupTime = Date.now() - startTime;

      MCPValidator.validateInitializeResponse(initResponse);
      
      // Server should start within reasonable time
      TestAssert.assertTrue(startupTime < 5000, `Server startup took ${startupTime}ms (should be < 5000ms)`);
      
      console.log(`    Server startup time: ${startupTime}ms`);

    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test memory usage under load
   */
  suite.test('Memory Usage Under Load', async () => {
    const serverProcess = spawn('node', [
      '--expose-gc',
      path.resolve(__dirname, '../../build/index.js'),
      '--auto-install'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      await initializeServer(serverProcess);

      const memoryBefore = process.memoryUsage();
      
      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        await sendMCPMessage(serverProcess, messageBuilder.callTool('ast_search', {
          pattern: 'function $NAME() { $$$ }',
          language: 'javascript',
          code: TEST_CONFIG.TEST_FILES.simple_js
        }));
      }

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`    Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory increase should be reasonable
      TestAssert.assertTrue(
        memoryIncreaseMB < TEST_CONFIG.PERFORMANCE.MAX_MEMORY_MB,
        `Memory increase ${memoryIncreaseMB.toFixed(2)}MB exceeds limit ${TEST_CONFIG.PERFORMANCE.MAX_MEMORY_MB}MB`
      );

    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test concurrent tool calls
   */
  suite.test('Concurrent Tool Execution', async () => {
    const serverProcess = spawn('node', [path.resolve(__dirname, '../../build/index.js'), '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      await initializeServer(serverProcess);

      const startTime = Date.now();
      
      // Send multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          sendMCPMessage(serverProcess, messageBuilder.callTool('ast_search', {
            pattern: `function test${i}() { $$$ }`,
            language: 'javascript',
            code: `function test${i}() { console.log("test${i}"); }`
          }))
        );
      }

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      for (const response of responses) {
        MCPValidator.validateToolCallResponse(response, 'ast_search');
      }

      console.log(`    Processed 10 concurrent requests in ${totalTime}ms`);
      
      // Should handle concurrent requests efficiently
      TestAssert.assertTrue(totalTime < 10000, `Concurrent execution took ${totalTime}ms (should be < 10000ms)`);

    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test large file processing
   */
  suite.test('Large File Processing', async () => {
    const serverProcess = spawn('node', [path.resolve(__dirname, '../../build/index.js'), '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      await initializeServer(serverProcess);

      const startTime = Date.now();
      
      const response = await sendMCPMessage(
        serverProcess, 
        messageBuilder.callTool('ast_search', {
          pattern: 'function $NAME() { $$$ }',
          language: 'javascript',
          paths: [largeTestFile]
        }),
        TEST_CONFIG.TIMEOUTS.LONG_RUNNING
      );

      const processingTime = Date.now() - startTime;

      MCPValidator.validateToolCallResponse(response, 'ast_search');
      
      console.log(`    Processed large file (1000 functions) in ${processingTime}ms`);
      
      // Should process large files within reasonable time
      TestAssert.assertTrue(
        processingTime < TEST_CONFIG.PERFORMANCE.MAX_SEARCH_TIME * 5, // 5x normal limit for large files
        `Large file processing took ${processingTime}ms (should be < ${TEST_CONFIG.PERFORMANCE.MAX_SEARCH_TIME * 5}ms)`
      );

    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test tool execution speed
   */
  suite.test('Tool Execution Speed', async () => {
    const serverProcess = spawn('node', [path.resolve(__dirname, '../../build/index.js'), '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      await initializeServer(serverProcess);

      // Test each tool's performance
      const tools = ['ast_search', 'ast_replace', 'ast_run_rule'];
      
      for (const toolName of tools) {
        const startTime = Date.now();
        
        let response;
        if (toolName === 'ast_search') {
          response = await sendMCPMessage(serverProcess, messageBuilder.callTool(toolName, {
            pattern: 'console.log($ARG)',
            language: 'javascript',
            code: TEST_CONFIG.TEST_FILES.simple_js
          }));
        } else if (toolName === 'ast_replace') {
          response = await sendMCPMessage(serverProcess, messageBuilder.callTool(toolName, {
            pattern: 'console.log($ARG)',
            replacement: 'logger.info($ARG)',
            language: 'javascript',
            code: TEST_CONFIG.TEST_FILES.simple_js
          }));
        } else if (toolName === 'ast_run_rule') {
          response = await sendMCPMessage(serverProcess, messageBuilder.callTool(toolName, {
            id: 'test-rule',
            language: 'javascript',
            pattern: 'console.log($ARG)',
            message: 'Found console.log',
            code: TEST_CONFIG.TEST_FILES.simple_js
          }));
        }

        const executionTime = Date.now() - startTime;
        
        MCPValidator.validateToolCallResponse(response, toolName);
        
        console.log(`    ${toolName} execution time: ${executionTime}ms`);
        
        // Check performance limits
        const maxTime = TEST_CONFIG.PERFORMANCE[`MAX_${toolName.toUpperCase().replace('AST_', '')}_TIME`] || 5000;
        TestAssert.assertTrue(
          executionTime < maxTime,
          `${toolName} took ${executionTime}ms (should be < ${maxTime}ms)`
        );
      }

    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test error handling under stress
   */
  suite.test('Error Handling Under Stress', async () => {
    const serverProcess = spawn('node', [path.resolve(__dirname, '../../build/index.js'), '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });

    try {
      await initializeServer(serverProcess);

      // Send multiple invalid requests rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          sendMCPMessage(serverProcess, messageBuilder.callTool('ast_search', {
            pattern: 'invalid(((pattern',
            language: 'javascript'
          })).catch(error => ({ error: true, message: error.message }))
        );
      }

      const responses = await Promise.all(promises);
      
      // All should return proper error responses
      let errorCount = 0;
      for (const response of responses) {
        if (response.error || (response.jsonrpc && response.error)) {
          errorCount++;
        }
      }

      TestAssert.assertTrue(errorCount > 15, `Expected most requests to error, got ${errorCount}/20`);
      console.log(`    Handled ${errorCount}/20 error requests properly`);

    } finally {
      serverProcess.kill();
    }
  });

  // Helper functions
  async function initializeServer(serverProcess) {
    const initResponse = await sendMCPMessage(serverProcess, messageBuilder.initialize());
    MCPValidator.validateInitializeResponse(initResponse);
    
    serverProcess.stdin.write(JSON.stringify(messageBuilder.initialized()) + '\n');
  }

  async function sendMCPMessage(serverProcess, message, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      let responseBuffer = '';
      
      const onData = (data) => {
        responseBuffer += data.toString();
        const lines = responseBuffer.split('\n');
        
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              if (response.id === message.id || response.error) {
                clearTimeout(timeout);
                serverProcess.stdout.removeListener('data', onData);
                resolve(response);
                return;
              }
            } catch (parseError) {
              // Continue parsing
            }
          }
        }
        
        responseBuffer = lines[lines.length - 1];
      };

      serverProcess.stdout.on('data', onData);
      serverProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  function generateLargeCodeFile(functionCount) {
    let code = '// Large test file for performance testing\n\n';
    
    for (let i = 0; i < functionCount; i++) {
      code += `
function func${i}(param1, param2) {
  console.log(\`Function \${${i}} called with \${param1}, \${param2}\`);
  
  if (param1 > param2) {
    return param1 * param2;
  } else {
    return param1 + param2;
  }
}
`;
    }
    
    return code;
  }

  return suite;
}