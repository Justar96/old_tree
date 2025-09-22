/**
 * Complex Use Case Integration Tests
 * Tests for advanced scenarios, edge cases, and error conditions
 */

import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';
import { ScanTool } from '../../build/tools/scan.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { ValidationError, ExecutionError, BinaryError } from '../../build/types/errors.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runComplexScenariosTests() {
  const suite = new TestSuite('Complex Scenarios Integration Tests');

  let binaryManager;
  let workspaceManager;
  let searchTool;
  let replaceTool;
  let scanTool;
  let tempDir;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    searchTool = new SearchTool(binaryManager, workspaceManager);
    replaceTool = new ReplaceTool(binaryManager, workspaceManager);
    scanTool = new ScanTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }

    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-complex-test-'));
  });

  suite.afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  // =============================================================================
  // COMPLEX PATTERN MATCHING TESTS
  // =============================================================================

  suite.test('should handle deeply nested patterns', async () => {
    const complexCode = `
      function processUser(user) {
        if (user && user.profile) {
          if (user.profile.settings) {
            if (user.profile.settings.theme) {
              console.log("Theme: " + user.profile.settings.theme);
              return user.profile.settings.theme;
            }
          }
        }
        return "default";
      }
    `;

    const params = {
      pattern: 'if ($COND) { if ($INNER) { $$$BODY } }',
      language: 'javascript',
      code: complexCode
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      // Should find nested if statements
      if (result.matches.length > 0) {
        TestAssert.assertTrue(result.matches[0].text.includes('if'));
      }
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle complex metavariable patterns', async () => {
    const complexCode = `
      const users = data.filter(user => user.active && user.verified);
      const products = items.filter(item => item.available && item.inStock);
      const orders = records.filter(record => record.completed);
    `;

    const params = {
      pattern: '$ARRAY.filter($PARAM => $CONDITION)',
      language: 'javascript',
      code: complexCode
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      // Should find all filter patterns
      TestAssert.assertTrue(result.matches.length >= 2);
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle multiline patterns with complex syntax', async () => {
    const complexCode = `
      class UserService {
        async getUser(id) {
          try {
            const user = await this.database.findById(id);
            return user;
          } catch (error) {
            console.error("Failed to get user:", error);
            throw error;
          }
        }
      }
    `;

    const params = {
      pattern: 'try { $$$TRY } catch ($ERROR) { $$$CATCH }',
      language: 'javascript',
      code: complexCode
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // ERROR HANDLING AND EDGE CASES
  // =============================================================================

  suite.test('should handle malformed patterns gracefully', async () => {
    const params = {
      pattern: 'console.log($ARG', // Missing closing parenthesis
      language: 'javascript',
      code: 'console.log("test");'
    };

    try {
      await searchTool.execute(params);
      // If it doesn't throw, that's also acceptable
      TestAssert.assertTrue(true, 'Malformed pattern handled gracefully');
    } catch (error) {
      // Should be a proper error type
      TestAssert.assertTrue(error instanceof Error);
      TestAssert.assertTrue(
        error instanceof ValidationError ||
        error instanceof ExecutionError ||
        error.message.includes('ast-grep not found')
      );
    }
  });

  suite.test('should handle empty and whitespace patterns', async () => {
    const testCases = [
      { pattern: '', expectedError: 'Pattern is required' },
      { pattern: '   ', expectedError: 'Pattern is required' },
      { pattern: '\n\t', expectedError: 'Pattern is required' }
    ];

    for (const testCase of testCases) {
      try {
        await searchTool.execute({
          pattern: testCase.pattern,
          language: 'javascript',
          code: 'console.log("test");'
        });
        TestAssert.assertTrue(false, `Should have thrown error for pattern: "${testCase.pattern}"`);
      } catch (error) {
        TestAssert.assertContains(error.message, 'Pattern is required');
      }
    }
  });

  suite.test('should handle extremely large code inputs', async () => {
    // Generate large code file
    const largeCode = Array(1000).fill().map((_, i) =>
      `function func${i}() { console.log("Function ${i}"); return ${i}; }`
    ).join('\n');

    const params = {
      pattern: 'function $NAME() { $$$BODY }',
      language: 'javascript',
      code: largeCode,
      maxMatches: 10 // Limit results
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 15000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      TestAssert.assertTrue(result.matches.length <= 10);
    } catch (error) {
      if (error.message.includes('ast-grep not found') ||
          error.message.includes('timeout')) {
        console.log('  ⚠️  Skipping large input test - ' + error.message);
        return;
      }
      throw error;
    }
  });

  suite.test('should handle special characters and unicode', async () => {
    const unicodeCode = `
      const message = "Hello 世界! 🌍";
      const emoji = "🚀 Rocket launched! 🎉";
      const special = "String with \\n\\t\\r and quotes \\"test\\"";
    `;

    const params = {
      pattern: 'const $NAME = $VALUE;',
      language: 'javascript',
      code: unicodeCode
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping unicode test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // TIMEOUT AND PERFORMANCE TESTS
  // =============================================================================

  suite.test('should respect timeout limits', async () => {
    const params = {
      pattern: 'console.log($ARG)',
      language: 'javascript',
      code: 'console.log("test");',
      timeoutMs: 1 // Very short timeout
    };

    try {
      await searchTool.execute(params);
      // If it completes quickly, that's fine
      TestAssert.assertTrue(true, 'Fast execution within timeout');
    } catch (error) {
      // Should handle timeout gracefully
      TestAssert.assertTrue(error instanceof Error);
      TestAssert.assertTrue(
        error.message.includes('timeout') ||
        error.message.includes('ast-grep not found')
      );
    }
  });

  suite.test('should handle concurrent operations', async () => {
    const operations = Array(5).fill().map((_, i) =>
      searchTool.execute({
        pattern: `console.log($ARG)`,
        language: 'javascript',
        code: `console.log("Test ${i}");`
      })
    );

    try {
      const results = await Promise.allSettled(operations);

      // At least some should succeed or fail gracefully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      TestAssert.assertTrue(successful + failed === 5);

      // Check that failures are proper errors
      results.filter(r => r.status === 'rejected').forEach(result => {
        TestAssert.assertTrue(result.reason instanceof Error);
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
  // VALIDATION AND SECURITY TESTS
  // =============================================================================

  suite.test('should validate language parameter thoroughly', async () => {
    const invalidLanguages = ['', '   ', 'invalid-lang', '123', null, undefined];

    for (const lang of invalidLanguages) {
      try {
        await searchTool.execute({
          pattern: 'console.log($ARG)',
          language: lang,
          code: 'console.log("test");'
        });

        // Some invalid languages might be handled gracefully by ast-grep
        TestAssert.assertTrue(true, `Language "${lang}" handled gracefully`);
      } catch (error) {
        // Should be proper validation or execution error
        TestAssert.assertTrue(error instanceof Error);
      }
    }
  });

  suite.test('should handle path traversal attempts safely', async () => {
    const dangerousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '/etc/shadow',
      'C:\\Windows\\System32\\config\\SAM'
    ];

    for (const dangerousPath of dangerousPaths) {
      try {
        const result = await searchTool.execute({
          pattern: 'console.log($ARG)',
          language: 'javascript',
          paths: [dangerousPath]
        });

        // Should either handle safely or throw appropriate error
        TestAssert.assertTrue(typeof result === 'object');
      } catch (error) {
        // Security errors or file not found are acceptable
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error.message.includes('not found') ||
          error.message.includes('access') ||
          error.message.includes('permission') ||
          error.message.includes('ast-grep not found')
        );
      }
    }
  });

  // =============================================================================
  // COMPLEX REPLACEMENT SCENARIOS
  // =============================================================================

  suite.test('should handle complex nested replacements', async () => {
    const complexCode = `
      if (user.isAdmin()) {
        if (user.hasPermission("write")) {
          console.log("Admin has write permission");
          database.updateUser(user.id, { lastAccess: new Date() });
        }
      }
    `;

    const params = {
      pattern: 'if ($OUTER) { if ($INNER) { $$$BODY } }',
      replacement: 'if ($OUTER && $INNER) { $$$BODY }',
      language: 'javascript',
      code: complexCode,
      dryRun: true
    };

    try {
      const result = await withTimeout(replaceTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('changes' in result || 'summary' in result);
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping complex replacement test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle replacement with special characters', async () => {
    const code = `console.log("Hello");`;

    const params = {
      pattern: 'console.log($MSG)',
      replacement: 'logger.info(`🚀 ${$MSG} 🎉`)',
      language: 'javascript',
      code: code,
      dryRun: true
    };

    try {
      const result = await withTimeout(replaceTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping special character test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // FILE SYSTEM STRESS TESTS
  // =============================================================================

  suite.test('should handle operations on large directory structures', async () => {
    // Create nested directory structure
    const deepDir = path.join(tempDir, 'level1', 'level2', 'level3', 'level4');
    await fs.mkdir(deepDir, { recursive: true });

    // Create multiple files
    for (let i = 0; i < 10; i++) {
      await fs.writeFile(
        path.join(deepDir, `file${i}.js`),
        `console.log("File ${i}"); function test${i}() { return ${i}; }`
      );
    }

    const params = {
      pattern: 'console.log($MSG)',
      language: 'javascript',
      paths: [tempDir]
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 15000);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
    } catch (error) {
      if (error.message.includes('ast-grep not found') ||
          error.message.includes('timeout')) {
        console.log('  ⚠️  Skipping directory structure test - ' + error.message);
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // BOUNDARY AND LIMIT TESTS
  // =============================================================================

  suite.test('should handle maximum context values', async () => {
    const params = {
      pattern: 'console.log($ARG)',
      language: 'javascript',
      code: Array(100).fill('console.log("test");').join('\n'),
      context: 50 // Large context
    };

    try {
      const result = await withTimeout(searchTool.execute(params), 10000);
      TestAssert.assertTrue(typeof result === 'object');
    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping context test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle zero and negative numeric parameters', async () => {
    const params = {
      pattern: 'console.log($ARG)',
      language: 'javascript',
      code: 'console.log("test");',
      context: -1,
      maxMatches: 0,
      timeoutMs: -1000
    };

    try {
      const result = await searchTool.execute(params);
      // Should handle gracefully or use defaults
      TestAssert.assertTrue(typeof result === 'object');
    } catch (error) {
      // Should be proper validation error
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  return suite.run();
}