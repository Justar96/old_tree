// Enhanced error handling tests
import { MCPTestFramework } from './test-framework.js';
import { TestSuite } from './test-framework.js';

async function testEnhancedErrorHandling() {
  console.log('🧪 Running Enhanced Error Handling Tests...\n');

  const framework = new MCPTestFramework();
  await framework.initialize();

  const suite = new TestSuite('Enhanced Error Handling');

  // Test various error scenarios with context
  const errorTests = [
    {
      name: 'Invalid pattern with context',
      test: async () => {
        try {
          await framework.searchTool.execute({
            pattern: 'invalid pattern [[[',
            language: 'javascript',
            paths: ['test-example.js']
          });
          throw new Error('Should have thrown error for invalid pattern');
        } catch (error) {
          if (error.message.includes('Invalid AST pattern syntax') && error.message.includes('Pattern:')) {
            return { message: 'Error includes pattern context' };
          }
          throw new Error(`Expected pattern context in error, got: ${error.message}`);
        }
      }
    },
    {
      name: 'File not found with workspace context',
      test: async () => {
        try {
          await framework.searchTool.execute({
            pattern: 'console.log($_)',
            language: 'javascript',
            paths: ['nonexistent-file.js']
          });
          throw new Error('Should have thrown error for missing file');
        } catch (error) {
          if (error.message.includes('workspace root') && error.message.includes('D:\\_Project\\_mcp\\old_tree\\tree-ast-grep-mcp')) {
            return { message: 'Error includes workspace context' };
          }
          throw new Error(`Expected workspace context in error, got: ${error.message}`);
        }
      }
    },
    {
      name: 'Unsupported language with suggestions',
      test: async () => {
        try {
          await framework.searchTool.execute({
            pattern: 'test',
            language: 'unsupported-language',
            paths: ['test-example.js']
          });
          throw new Error('Should have thrown error for unsupported language');
        } catch (error) {
          if (error.message.includes('Available languages:') && error.message.includes('javascript')) {
            return { message: 'Error includes language suggestions' };
          }
          throw new Error(`Expected language suggestions in error, got: ${error.message}`);
        }
      }
    },
    {
      name: 'Path outside workspace',
      test: async () => {
        try {
          const outsidePath = 'C:\\Windows\\System32\\cmd.exe';
          await framework.searchTool.execute({
            pattern: 'test',
            language: 'javascript',
            paths: [outsidePath]
          });
          throw new Error('Should have thrown error for path outside workspace');
        } catch (error) {
          if (error.message.includes('outside workspace') || error.message.includes('Invalid paths')) {
            return { message: 'Security check working correctly' };
          }
          throw new Error(`Expected workspace security error, got: ${error.message}`);
        }
      }
    }
  ];

  for (const errorTest of errorTests) {
    await suite.runTest(errorTest.name, errorTest.test);
  }

  suite.printSummary();
  return suite.getSummary();
}

export { testEnhancedErrorHandling };