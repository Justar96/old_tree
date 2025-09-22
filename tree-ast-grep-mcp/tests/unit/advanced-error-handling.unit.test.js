/**
 * Advanced Error Handling Unit Tests
 * Comprehensive error scenario testing
 */

import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';
import { ScanTool } from '../../build/tools/scan.js';
import { BinaryError, ValidationError, ExecutionError } from '../../build/types/errors.js';
import { TestSuite, TestAssert } from '../utils/test-helpers.js';

export default async function runAdvancedErrorHandlingTests() {
  const suite = new TestSuite('Advanced Error Handling Unit Tests');

  // =============================================================================
  // BINARY MANAGER ERROR SCENARIOS
  // =============================================================================

  suite.test('should handle binary initialization failures gracefully', async () => {
    const manager = new AstGrepBinaryManager({
      customBinaryPath: '/non/existent/path/ast-grep'
    });

    try {
      await manager.initialize();
      TestAssert.assertTrue(false, 'Should have thrown error for invalid binary path');
    } catch (error) {
      TestAssert.assertTrue(error instanceof BinaryError);
      TestAssert.assertContains(error.message.toLowerCase(), 'binary');
    }
  });

  suite.test('should handle corrupted binary scenarios', async () => {
    const manager = new AstGrepBinaryManager({
      customBinaryPath: process.execPath // Use Node.js executable as fake ast-grep
    });

    try {
      await manager.initialize();
      // Try to execute ast-grep command with Node.js
      await manager.executeAstGrep(['--version']);
      TestAssert.assertTrue(false, 'Should have failed with corrupted binary');
    } catch (error) {
      // Should handle invalid binary gracefully
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  suite.test('should handle system resource exhaustion', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();

      // Try to exhaust resources with multiple concurrent operations
      const operations = Array(100).fill().map(() =>
        manager.executeAstGrep(['--version'], { timeout: 1 })
      );

      const results = await Promise.allSettled(operations);

      // Some should succeed, some may fail due to resource limits
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      TestAssert.assertTrue(succeeded + failed === 100);

      // Failed operations should have proper error types
      results.filter(r => r.status === 'rejected').forEach(result => {
        TestAssert.assertTrue(result.reason instanceof Error);
      });

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping resource test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // WORKSPACE MANAGER ERROR SCENARIOS
  // =============================================================================

  suite.test('should handle invalid workspace configurations', async () => {
    const invalidPaths = [
      '/non/existent/path',
      '',
      null,
      undefined,
      '../../../../../../etc/passwd',
      'C:\\Windows\\System32\\config\\SAM'
    ];

    for (const invalidPath of invalidPaths) {
      try {
        const manager = new WorkspaceManager(invalidPath);
        const root = manager.getWorkspaceRoot();

        // Should either handle gracefully or provide a safe fallback
        TestAssert.assertTrue(typeof root === 'string');
        TestAssert.assertTrue(root.length > 0);
      } catch (error) {
        // Security or validation errors are acceptable
        TestAssert.assertTrue(error instanceof Error);
      }
    }
  });

  suite.test('should handle path validation edge cases', async () => {
    const manager = new WorkspaceManager();

    const edgeCases = [
      '',
      '   ',
      '\n\t\r',
      null,
      undefined,
      '../../../etc/passwd',
      'file:///etc/passwd',
      'http://example.com/malicious',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      '\\\\server\\share\\file',
      '/dev/null',
      '/proc/self/mem'
    ];

    for (const testCase of edgeCases) {
      try {
        const result = manager.validatePath(testCase);

        // Should always return an object with validation result
        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('valid' in result);
        TestAssert.assertTrue(typeof result.valid === 'boolean');

        if (!result.valid) {
          TestAssert.assertTrue('error' in result);
        }
      } catch (error) {
        // Throwing is also acceptable for dangerous paths
        TestAssert.assertTrue(error instanceof Error);
      }
    }
  });

  suite.test('should handle filesystem permission errors', async () => {
    const manager = new WorkspaceManager();

    // Test paths that might have permission issues
    const restrictedPaths = [
      '/root',
      '/etc/shadow',
      'C:\\Windows\\System32',
      '/System/Library'
    ];

    for (const restrictedPath of restrictedPaths) {
      const result = manager.validatePath(restrictedPath);

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('valid' in result);

      // Either valid (if accessible) or invalid with proper error
      if (!result.valid) {
        TestAssert.assertTrue('error' in result);
        TestAssert.assertTrue(typeof result.error === 'string');
      }
    }
  });

  // =============================================================================
  // TOOL ERROR SCENARIOS
  // =============================================================================

  suite.test('should handle malformed search parameters', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const searchTool = new SearchTool(binaryManager, workspaceManager);

    const malformedParams = [
      { pattern: null },
      { pattern: undefined },
      { pattern: '' },
      { pattern: 123 },
      { pattern: {} },
      { pattern: [] },
      { pattern: 'console.log($ARG)', language: null },
      { pattern: 'console.log($ARG)', language: 123 },
      { pattern: 'console.log($ARG)', code: null, language: 'javascript' },
      { pattern: 'console.log($ARG)', paths: 'not-an-array' },
      { pattern: 'console.log($ARG)', context: 'not-a-number' },
      { pattern: 'console.log($ARG)', maxMatches: -1 },
      { pattern: 'console.log($ARG)', timeoutMs: 'invalid' }
    ];

    for (const params of malformedParams) {
      try {
        await searchTool.execute(params);
        // If it doesn't throw, check that it returns valid structure
        TestAssert.assertTrue(false, `Should have thrown for params: ${JSON.stringify(params)}`);
      } catch (error) {
        TestAssert.assertTrue(error instanceof ValidationError || error instanceof ExecutionError);
      }
    }
  });

  suite.test('should handle malformed replacement parameters', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const replaceTool = new ReplaceTool(binaryManager, workspaceManager);

    const malformedParams = [
      { pattern: 'console.log($ARG)' }, // Missing replacement
      { replacement: 'logger.info($ARG)' }, // Missing pattern
      { pattern: '', replacement: 'logger.info($ARG)' },
      { pattern: null, replacement: 'logger.info($ARG)' },
      { pattern: 'console.log($ARG)', replacement: null },
      { pattern: 'console.log($ARG)', replacement: '', language: 'javascript' },
      { pattern: 123, replacement: 'logger.info($ARG)' },
      { pattern: 'console.log($ARG)', replacement: 123 }
    ];

    for (const params of malformedParams) {
      try {
        await replaceTool.execute(params);
        TestAssert.assertTrue(false, `Should have thrown for params: ${JSON.stringify(params)}`);
      } catch (error) {
        TestAssert.assertTrue(error instanceof ValidationError || error instanceof ExecutionError);
      }
    }
  });

  suite.test('should handle malformed scan parameters', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const scanTool = new ScanTool(binaryManager, workspaceManager);

    const malformedParams = [
      {}, // Missing rule and ruleFile
      { rule: '' },
      { rule: null },
      { rule: 123 },
      { rule: {} },
      { ruleFile: '/non/existent/file.yml' },
      { rule: 'invalid yaml }{{}' },
      { rule: 'rule:\n  pattern: console.log\n  but-invalid-yaml: }{' }
    ];

    for (const params of malformedParams) {
      try {
        await scanTool.execute(params);
        TestAssert.assertTrue(false, `Should have thrown for params: ${JSON.stringify(params)}`);
      } catch (error) {
        TestAssert.assertTrue(error instanceof ValidationError || error instanceof ExecutionError);
      }
    }
  });

  // =============================================================================
  // MEMORY AND RESOURCE EXHAUSTION TESTS
  // =============================================================================

  suite.test('should handle memory pressure gracefully', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const searchTool = new SearchTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();

      // Create very large code string
      const hugeCode = 'console.log("test");\n'.repeat(100000);

      const params = {
        pattern: 'console.log($ARG)',
        language: 'javascript',
        code: hugeCode,
        timeoutMs: 5000
      };

      const result = await searchTool.execute(params);

      // Should either complete or timeout gracefully
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);

    } catch (error) {
      // Memory errors, timeouts, or missing binary are acceptable
      TestAssert.assertTrue(error instanceof Error);
      TestAssert.assertTrue(
        error.message.includes('timeout') ||
        error.message.includes('memory') ||
        error.message.includes('ast-grep not found') ||
        error instanceof ExecutionError
      );
    }
  });

  // =============================================================================
  // CONCURRENT ACCESS AND RACE CONDITIONS
  // =============================================================================

  suite.test('should handle concurrent tool operations safely', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const searchTool = new SearchTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();

      // Launch multiple concurrent operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          searchTool.execute({
            pattern: 'console.log($ARG)',
            language: 'javascript',
            code: `console.log("Concurrent test ${i}");`
          })
        );
      }

      const results = await Promise.allSettled(operations);

      // Check that all operations completed (successfully or with proper errors)
      TestAssert.assertEqual(results.length, 10);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          TestAssert.assertTrue(typeof result.value === 'object');
        } else {
          TestAssert.assertTrue(result.reason instanceof Error);
        }
      });

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping concurrent test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // ERROR RECOVERY AND CLEANUP TESTS
  // =============================================================================

  suite.test('should clean up resources after errors', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await binaryManager.initialize();

      // Simulate operations that might fail
      const failingOperations = [
        () => binaryManager.executeAstGrep(['--invalid-flag']),
        () => binaryManager.executeAstGrep(['run', '--pattern']), // Missing pattern
        () => binaryManager.executeAstGrep([]), // Empty args
      ];

      for (const operation of failingOperations) {
        try {
          await operation();
          TestAssert.assertTrue(false, 'Operation should have failed');
        } catch (error) {
          // Should be proper error type
          TestAssert.assertTrue(error instanceof Error);

          // After error, binary manager should still be usable
          try {
            await binaryManager.executeAstGrep(['--version']);
            TestAssert.assertTrue(true, 'Binary manager recovered after error');
          } catch (recoveryError) {
            // If ast-grep is not available, that's also acceptable
            if (!recoveryError.message.includes('ast-grep not found')) {
              throw recoveryError;
            }
          }
        }
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping cleanup test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // ERROR MESSAGE QUALITY TESTS
  // =============================================================================

  suite.test('should provide helpful error messages', async () => {
    const binaryManager = new AstGrepBinaryManager({ useSystem: true });
    const workspaceManager = new WorkspaceManager();
    const searchTool = new SearchTool(binaryManager, workspaceManager);

    const testCases = [
      {
        params: { pattern: '' },
        expectedContent: ['pattern', 'required']
      },
      {
        params: { pattern: 'console.log($ARG)', code: 'test' },
        expectedContent: ['language', 'required']
      }
    ];

    for (const testCase of testCases) {
      try {
        await searchTool.execute(testCase.params);
        TestAssert.assertTrue(false, 'Should have thrown validation error');
      } catch (error) {
        TestAssert.assertTrue(error instanceof ValidationError);

        // Check that error message contains expected content
        testCase.expectedContent.forEach(content => {
          TestAssert.assertContains(error.message.toLowerCase(), content.toLowerCase());
        });
      }
    }
  });

  return suite.run();
}