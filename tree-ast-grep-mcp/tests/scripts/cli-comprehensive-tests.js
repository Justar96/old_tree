#!/usr/bin/env node

/**
 * MCP Inspector-style CLI Testing
 * Comprehensive CLI testing following Inspector patterns
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  BLUE: '\x1b[34m',
  NC: '\x1b[0m', // No Color
};

let PASSED_TESTS = 0;
let FAILED_TESTS = 0;
let TOTAL_TESTS = 0;

// Test configuration
const MCP_SERVER_PATH = path.resolve(__dirname, '../../build/index.js');
const OUTPUT_DIR = path.join(__dirname, '../cli-test-output');
const TEMP_DIR = path.join(tmpdir(), 'mcp-cli-tests');

async function setupTestEnvironment() {
  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Create temp directory
  await fs.mkdir(TEMP_DIR, { recursive: true });
  
  // Create test files
  const testFiles = {
    'simple.js': `
function testFunction() {
  console.log("hello world");
  return true;
}

class TestClass {
  constructor() {
    this.value = 42;
  }
}
`,
    'complex.js': `
import React from 'react';

function Component({ name, children }) {
  const [state, setState] = useState(false);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  return (
    <div className={state ? 'active' : 'inactive'}>
      <h1>{name}</h1>
      {children}
    </div>
  );
}

export default Component;
`,
    'nested/helper.js': `
export function helper(input) {
  console.log('Processing:', input);
  return input.toUpperCase();
}
`
  };

  for (const [filename, content] of Object.entries(testFiles)) {
    const filePath = path.join(TEMP_DIR, filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
}

async function cleanupTestEnvironment() {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.log(`${colors.YELLOW}Warning: Failed to cleanup temp directory${colors.NC}`);
  }
}

/**
 * Spawn MCP server and send messages, following Inspector patterns
 */
class MCPServerTester {
  constructor() {
    this.serverProcess = null;
    this.messageId = 0;
  }

  async start() {
    this.serverProcess = spawn('node', [MCP_SERVER_PATH, '--auto-install'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: TEMP_DIR
    });

    // Handle server errors
    this.serverProcess.on('error', (error) => {
      console.error(`${colors.RED}Server process error: ${error.message}${colors.NC}`);
    });

    this.serverProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`${colors.RED}Server exited with code ${code}${colors.NC}`);
      }
    });

    // Capture stderr for debugging
    let stderrOutput = '';
    this.serverProcess.stderr.on('data', (data) => {
      stderrOutput += data.toString();
    });

    // Wait a moment for the server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Initialize the server
    const initResponse = await this.sendMessage({
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'cli-test', version: '1.0.0' }
      }
    });

    if (initResponse.error) {
      if (stderrOutput) {
        console.error(`${colors.RED}Server stderr: ${stderrOutput}${colors.NC}`);
      }
      throw new Error(`Server initialization failed: ${initResponse.error.message}`);
    }

    // Send initialized notification
    this.serverProcess.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }) + '\n');
  }

  async sendMessage(message, timeoutMs = 10000) {
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
                this.serverProcess.stdout.removeListener('data', onData);
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

      this.serverProcess.stdout.on('data', onData);
      this.serverProcess.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  async callTool(toolName, args) {
    return this.sendMessage({
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });
  }

  async listTools() {
    return this.sendMessage({
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: 'tools/list',
      params: {}
    });
  }

  stop() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
  }
}

/**
 * Run a CLI test with proper logging
 */
async function runCLITest(testName, testFn) {
  const outputFile = path.join(OUTPUT_DIR, `${testName.replace(/\s+/g, '_')}.log`);
  
  console.log(`\n${colors.YELLOW}Testing: ${testName}${colors.NC}`);
  TOTAL_TESTS++;

  const logStream = await fs.open(outputFile, 'w');
  
  try {
    const server = new MCPServerTester();
    await server.start();
    
    const startTime = Date.now();
    const result = await testFn(server);
    const duration = Date.now() - startTime;
    
    server.stop();
    
    await logStream.write(`Test: ${testName}\n`);
    await logStream.write(`Duration: ${duration}ms\n`);
    await logStream.write(`Result: PASSED\n`);
    await logStream.write(`Output: ${JSON.stringify(result, null, 2)}\n`);
    
    console.log(`${colors.GREEN}✓ ${testName} (${duration}ms)${colors.NC}`);
    PASSED_TESTS++;
    
  } catch (error) {
    await logStream.write(`Test: ${testName}\n`);
    await logStream.write(`Result: FAILED\n`);
    await logStream.write(`Error: ${error.message}\n`);
    await logStream.write(`Stack: ${error.stack}\n`);
    
    console.log(`${colors.RED}✗ ${testName}: ${error.message}${colors.NC}`);
    FAILED_TESTS++;
  } finally {
    await logStream.close();
  }
}

/**
 * Main test suite
 */
async function runCLITests() {
  console.log(`${colors.YELLOW}=== MCP Server CLI Tests ===${colors.NC}`);
  console.log(`${colors.BLUE}Testing MCP server functionality through JSON-RPC protocol${colors.NC}`);
  
  await setupTestEnvironment();

  try {
    // Test 1: Basic server initialization
    await runCLITest('Server Initialization', async (server) => {
      const response = await server.listTools();
      if (!response.result || !Array.isArray(response.result.tools)) {
        throw new Error('Failed to get tools list');
      }
      return { toolCount: response.result.tools.length };
    });

    // Test 2: Tool discovery
    await runCLITest('Tool Discovery', async (server) => {
      const response = await server.listTools();
      const tools = response.result.tools;
      const expectedTools = ['ast_search', 'ast_replace', 'ast_run_rule'];
      
      for (const expectedTool of expectedTools) {
        if (!tools.find(t => t.name === expectedTool)) {
          throw new Error(`Missing expected tool: ${expectedTool}`);
        }
      }
      
      // Validate tool schemas
      for (const tool of tools) {
        if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
          throw new Error(`Invalid schema for tool: ${tool.name}`);
        }
      }
      
      return { tools: tools.map(t => ({ name: t.name, description: t.description })) };
    });

    // Test 3: Search functionality
    await runCLITest('AST Search - Simple Pattern', async (server) => {
      const response = await server.callTool('ast_search', {
        pattern: 'console.log($ARG)',
        language: 'javascript',
        paths: [path.join(TEMP_DIR, 'simple.js')]
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      return { 
        contentBlocks: response.result.content.length,
        hasTextContent: response.result.content.some(c => c.type === 'text')
      };
    });

    // Test 4: Replace functionality with inline code
    await runCLITest('AST Replace - Inline Code', async (server) => {
      const response = await server.callTool('ast_replace', {
        pattern: 'console.log($ARG)',
        replacement: 'logger.info($ARG)',
        language: 'javascript',
        code: 'console.log("test message");'
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      const textContent = response.result.content.find(c => c.type === 'text');
      if (!textContent || !textContent.text.includes('logger.info')) {
        throw new Error('Replacement not applied correctly');
      }
      
      return { 
        replacementApplied: textContent.text.includes('logger.info'),
        output: textContent.text
      };
    });

    // Test 5: Rule scanning
    await runCLITest('AST Rule Scan', async (server) => {
      const response = await server.callTool('ast_run_rule', {
        id: 'console-usage',
        language: 'javascript',
        pattern: 'console.log($ARG)',
        message: 'Found console.log usage',
        paths: [path.join(TEMP_DIR, 'simple.js')]
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      return { 
        contentBlocks: response.result.content.length
      };
    });

    // Test 6: Error handling - Invalid pattern
    await runCLITest('Error Handling - Invalid Pattern', async (server) => {
      const response = await server.callTool('ast_search', {
        pattern: 'invalid(((pattern',
        language: 'javascript'
      });
      
      if (response.error) {
        // JSON-RPC error is acceptable
        return { 
          errorReceived: true,
          errorMessage: response.error.message
        };
      }
      
      // Check if it's handled gracefully (ast-grep might return 0 matches for invalid patterns)
      if (response.result && response.result.content) {
        const textContent = response.result.content.find(c => c.type === 'text');
        if (textContent && textContent.text.includes('"totalMatches": 0')) {
          return { 
            handledGracefully: true,
            response: textContent.text
          };
        }
      }
      
      throw new Error('Expected either error response or graceful handling of invalid pattern');
    });

    // Test 7: Error handling - Missing required parameters
    await runCLITest('Error Handling - Missing Parameters', async (server) => {
      const response = await server.callTool('ast_search', {
        language: 'javascript' // Missing required 'pattern'
      });
      
      if (response.error) {
        // JSON-RPC error is acceptable
        return { 
          errorReceived: true,
          errorCode: response.error.code
        };
      }
      
      // Check if validation error is returned as content
      if (response.result && response.result.content) {
        const textContent = response.result.content.find(c => c.type === 'text');
        if (textContent && textContent.text.includes('Validation Error')) {
          return { 
            validationError: true,
            message: textContent.text
          };
        }
      }
      
      throw new Error('Expected error response or validation error message');
    });

    // Test 8: Multiple file search
    await runCLITest('Multi-file Search', async (server) => {
      const response = await server.callTool('ast_search', {
        pattern: 'console.log($ARG)',
        language: 'javascript',
        paths: [
          path.join(TEMP_DIR, 'simple.js'),
          path.join(TEMP_DIR, 'complex.js'),
          path.join(TEMP_DIR, 'nested/helper.js')
        ]
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      return { 
        contentBlocks: response.result.content.length,
        searchedMultipleFiles: true
      };
    });

    // Test 9: Complex pattern matching
    await runCLITest('Complex Pattern - React Components', async (server) => {
      const response = await server.callTool('ast_search', {
        pattern: 'function $NAME({ $PROPS }) { $$$ }',
        language: 'javascript',
        paths: [path.join(TEMP_DIR, 'complex.js')]
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      return { 
        foundMatches: response.result.content.length > 0
      };
    });

    // Test 10: Tool with constraints
    await runCLITest('Rule with Constraints', async (server) => {
      const response = await server.callTool('ast_run_rule', {
        id: 'function-check',
        language: 'javascript',
        pattern: 'function $NAME() { $$$ }',
        message: 'Found function declaration',
        where: [
          { metavariable: 'NAME', equals: 'testFunction' }
        ],
        paths: [path.join(TEMP_DIR, 'simple.js')]
      });
      
      if (response.error) {
        throw new Error(`Tool call failed: ${response.error.message}`);
      }
      
      return { 
        constraintApplied: true,
        contentBlocks: response.result.content.length
      };
    });

  } finally {
    await cleanupTestEnvironment();
  }

  // Print summary
  console.log(`\n${colors.YELLOW}=== Test Summary ===${colors.NC}`);
  console.log(`${colors.GREEN}Passed: ${PASSED_TESTS}${colors.NC}`);
  console.log(`${colors.RED}Failed: ${FAILED_TESTS}${colors.NC}`);
  console.log(`Total: ${TOTAL_TESTS}`);
  console.log(`${colors.BLUE}Detailed logs saved to: ${OUTPUT_DIR}${colors.NC}`);

  if (FAILED_TESTS === 0) {
    console.log(`\n${colors.GREEN}All CLI tests passed!${colors.NC}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.RED}Some CLI tests failed.${colors.NC}`);
    process.exit(1);
  }
}

// Run tests
runCLITests().catch(error => {
  console.error(`${colors.RED}Test runner error: ${error.message}${colors.NC}`);
  process.exit(1);
});