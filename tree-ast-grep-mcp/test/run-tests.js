// Test runner for MCP server validation
import { MCPTestFramework } from './test-framework.js';

async function main() {
  const framework = new MCPTestFramework();
  await framework.runAllTests();
}

main().catch(console.error);