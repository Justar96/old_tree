/**
 * MCP Protocol Integration Tests
 * Based on MCP Inspector testing patterns
 */

import { spawn } from 'child_process';
import { TestSuite, TestAssert } from '../utils/test-helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { tmpdir } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function runMCPProtocolTests() {
  const suite = new TestSuite('MCP Protocol Integration Tests');

  let tempDir;
  let testFilePath;

  suite.beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-protocol-test-'));
    testFilePath = path.join(tempDir, 'test.js');
    await fs.writeFile(testFilePath, `
function testFunction() {
  console.log("hello world");
  return true;
}

class TestClass {
  constructor() {
    this.value = 42;
  }
}
`);
  });

  suite.afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Test MCP server initialization following Inspector patterns
   */
  suite.test('should handle MCP initialization protocol', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      // Send initialize request
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      const response = await sendMCPMessage(serverProcess, initRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 1);
      TestAssert.assertTrue(response.result !== undefined);
      TestAssert.assertTrue(response.result.capabilities !== undefined);
      TestAssert.assertTrue(response.result.capabilities.tools !== undefined);
      
      // Send initialized notification
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      };
      
      serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');
      
    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test tools/list following Inspector validation patterns
   */
  suite.test('should list available tools with proper schema', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      await initializeMCPServer(serverProcess);
      
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await sendMCPMessage(serverProcess, listToolsRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 2);
      TestAssert.assertTrue(Array.isArray(response.result.tools));
      
      // Validate each tool has required properties
      for (const tool of response.result.tools) {
        TestAssert.assertTrue(typeof tool.name === 'string');
        TestAssert.assertTrue(typeof tool.description === 'string');
        TestAssert.assertTrue(tool.inputSchema !== undefined);
        TestAssert.assertEqual(tool.inputSchema.type, 'object');
      }
      
      // Should have our three main tools
      const toolNames = response.result.tools.map(t => t.name);
      TestAssert.assertTrue(toolNames.includes('ast_search'));
      TestAssert.assertTrue(toolNames.includes('ast_replace'));
      TestAssert.assertTrue(toolNames.includes('ast_run_rule'));
      
    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test ast_search tool execution with various parameter formats
   */
  suite.test('should execute ast_search tool with valid parameters', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      await initializeMCPServer(serverProcess);
      
      const searchRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'ast_search',
          arguments: {
            pattern: 'console.log($ARG)',
            language: 'javascript',
            paths: [testFilePath]
          }
        }
      };

      const response = await sendMCPMessage(serverProcess, searchRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 3);
      TestAssert.assertTrue(response.result !== undefined);
      TestAssert.assertTrue(Array.isArray(response.result.content));
      
      if (response.result.content.length > 0) {
        const textContent = response.result.content.find(c => c.type === 'text');
        TestAssert.assertTrue(textContent !== undefined);
        TestAssert.assertContains(textContent.text, 'console.log');
      }
      
    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test ast_replace tool execution
   */
  suite.test('should execute ast_replace tool with valid parameters', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      await initializeMCPServer(serverProcess);
      
      const replaceRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'ast_replace',
          arguments: {
            pattern: 'console.log($ARG)',
            replacement: 'logger.info($ARG)',
            language: 'javascript',
            code: 'console.log("test");'
          }
        }
      };

      const response = await sendMCPMessage(serverProcess, replaceRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 4);
      TestAssert.assertTrue(response.result !== undefined);
      TestAssert.assertTrue(Array.isArray(response.result.content));
      
      const textContent = response.result.content.find(c => c.type === 'text');
      TestAssert.assertTrue(textContent !== undefined);
      TestAssert.assertContains(textContent.text, 'logger.info');
      
    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test error handling for invalid requests
   */
  suite.test('should handle invalid tool calls gracefully', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      await initializeMCPServer(serverProcess);
      
      // Test invalid tool name
      const invalidToolRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        }
      };

      const response = await sendMCPMessage(serverProcess, invalidToolRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 5);
      TestAssert.assertTrue(response.error !== undefined);
      TestAssert.assertEqual(response.error.code, -32602); // Invalid params
      
    } finally {
      serverProcess.kill();
    }
  });

  /**
   * Test parameter validation
   */
  suite.test('should validate tool parameters correctly', async () => {
    const serverProcess = await spawnMCPServer();
    
    try {
      await initializeMCPServer(serverProcess);
      
      // Test missing required parameter
      const invalidParamsRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'ast_search',
          arguments: {
            // Missing required 'pattern' parameter
            language: 'javascript'
          }
        }
      };

      const response = await sendMCPMessage(serverProcess, invalidParamsRequest);
      
      TestAssert.assertEqual(response.jsonrpc, '2.0');
      TestAssert.assertEqual(response.id, 6);
      TestAssert.assertTrue(response.error !== undefined);
      
    } finally {
      serverProcess.kill();
    }
  });

  // Helper functions
  async function spawnMCPServer() {
    const serverPath = path.resolve(__dirname, '../../build/index.js');
    return spawn('node', [serverPath, '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tempDir
    });
  }

  async function initializeMCPServer(serverProcess) {
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    await sendMCPMessage(serverProcess, initRequest);
    
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };
    
    serverProcess.stdin.write(JSON.stringify(initializedNotification) + '\n');
  }

  async function sendMCPMessage(serverProcess, message, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`MCP message timeout after ${timeoutMs}ms`));
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
              // Ignore parsing errors for partial responses
            }
          }
        }
        
        responseBuffer = lines[lines.length - 1];
      };

      serverProcess.stdout.on('data', onData);
      
      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Send the message
      serverProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  return suite;
}

// Auto-run if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('mcp-protocol.integration.test.js')) {
  try {
    const suite = await runMCPProtocolTests();
    await suite.run();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}