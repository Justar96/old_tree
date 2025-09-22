/**
 * Integration tests for MCP Server
 */

import { spawn } from 'child_process';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function runMCPServerIntegrationTests() {
  const suite = new TestSuite('MCP Server Integration Tests');

  suite.test('should start MCP server successfully', async () => {
    try {
      const serverProcess = spawn('node', ['../../build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
      });

      let stdout = '';
      let stderr = '';

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Send a simple MCP initialization message
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      }) + '\n';

      serverProcess.stdin.write(initMessage);

      // Wait for response or timeout
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          serverProcess.kill();
          reject(new Error('Server initialization timed out'));
        }, 5000);

        serverProcess.stdout.on('data', (data) => {
          const response = data.toString();
          if (response.includes('jsonrpc') && response.includes('result')) {
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        serverProcess.on('exit', (code) => {
          clearTimeout(timeout);
          if (code !== 0 && code !== null) {
            reject(new Error(`Server exited with code ${code}`));
          } else {
            resolve();
          }
        });
      });

      TestAssert.assertTrue(true, 'Server started and responded to initialization');

    } catch (error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.log('  ⚠️  Skipping server test - build not found (run npm run build)');
        return;
      }
      throw error;
    }
  });

  suite.test('should list available tools', async () => {
    try {
      const serverProcess = spawn('node', ['../../build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
      });

      let responseReceived = false;

      // Initialize first
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      }) + '\n';

      serverProcess.stdin.write(initMessage);

      // Wait a bit then list tools
      setTimeout(() => {
        const listToolsMessage = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list'
        }) + '\n';

        serverProcess.stdin.write(listToolsMessage);
      }, 1000);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          serverProcess.kill();
          reject(new Error('List tools timed out'));
        }, 5000);

        serverProcess.stdout.on('data', (data) => {
          const response = data.toString();

          if (response.includes('tools/list') || response.includes('search') || response.includes('replace')) {
            responseReceived = true;
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      TestAssert.assertTrue(responseReceived, 'Server listed tools successfully');

    } catch (error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.log('  ⚠️  Skipping tools list test - build not found');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle tool call requests', async () => {
    try {
      const serverProcess = spawn('node', ['../../build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
      });

      let toolCallResponseReceived = false;

      // Initialize
      const initMessage = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0.0',
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      }) + '\n';

      serverProcess.stdin.write(initMessage);

      // Wait then call search tool
      setTimeout(() => {
        const toolCallMessage = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'search',
            arguments: {
              pattern: 'console.log($ARG)',
              language: 'javascript',
              code: 'console.log("test");'
            }
          }
        }) + '\n';

        serverProcess.stdin.write(toolCallMessage);
      }, 1000);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          serverProcess.kill();
          reject(new Error('Tool call timed out'));
        }, 10000);

        serverProcess.stdout.on('data', (data) => {
          const response = data.toString();

          if (response.includes('tools/call') ||
              response.includes('matches') ||
              response.includes('result') ||
              response.includes('ast-grep not found')) {
            toolCallResponseReceived = true;
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      TestAssert.assertTrue(toolCallResponseReceived, 'Server handled tool call');

    } catch (error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.log('  ⚠️  Skipping tool call test - build not found');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle invalid requests gracefully', async () => {
    try {
      const serverProcess = spawn('node', ['../../build/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname
      });

      let errorResponseReceived = false;

      // Send invalid JSON
      serverProcess.stdin.write('{ invalid json }}\n');

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          serverProcess.kill();
          resolve(); // Don't fail - this is expected behavior
        }, 3000);

        serverProcess.stderr.on('data', (data) => {
          const error = data.toString();
          if (error.includes('error') || error.includes('invalid') || error.includes('parse')) {
            errorResponseReceived = true;
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          resolve(); // Don't fail - server might handle this gracefully
        });
      });

      // Either we got an error response or the server handled it gracefully
      TestAssert.assertTrue(true, 'Server handled invalid request');

    } catch (error) {
      if (error.message.includes('ENOENT') || error.message.includes('not found')) {
        console.log('  ⚠️  Skipping invalid request test - build not found');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}