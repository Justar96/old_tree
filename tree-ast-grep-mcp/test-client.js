// Simple test client to verify MCP tools work
import { spawn } from 'child_process';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testMCPServer() {
  // Spawn the MCP server process
  const serverProcess = spawn('node', ['build/index.js', '--auto-install'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: process.cwd()
  });

  // Create MCP client
  const transport = new StdioClientTransport({
    reader: serverProcess.stdout,
    writer: serverProcess.stdin
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    // Connect to server
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // List available tools
    const tools = await client.listTools();
    console.log('✅ Available tools:', tools.tools.map(t => t.name));

    // Test ast_search tool
    console.log('\n🔍 Testing ast_search tool...');
    const searchResult = await client.callTool('ast_search', {
      pattern: 'console.log($$$)',
      paths: ['test-example.js'],
      language: 'javascript',
      context: 1
    });

    console.log('Search result:', searchResult);

    // Test ast_replace tool (dry run)
    console.log('\n🔄 Testing ast_replace tool (dry run)...');
    const replaceResult = await client.callTool('ast_replace', {
      pattern: 'console.log($$$)',
      replacement: 'logger.info($$$)',
      paths: ['test-example.js'],
      language: 'javascript',
      dryRun: true
    });

    console.log('Replace result:', replaceResult);

    console.log('\n✅ All tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    serverProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

testMCPServer().catch(console.error);