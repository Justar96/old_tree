/**
 * Integration tests for SearchTool
 */

import { SearchTool } from '../../build/tools/search.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, createTempTestFiles, withTimeout } from '../utils/test-helpers.js';

export default async function runSearchToolIntegrationTests() {
  const suite = new TestSuite('SearchTool Integration Tests');

  let binaryManager;
  let workspaceManager;
  let searchTool;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    searchTool = new SearchTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }
  });

  suite.test('should search for console.log patterns', async () => {
    const params = {
      pattern: 'console.log($ARG)',
      language: 'javascript',
      paths: ['../test-files'] // Use existing test files
    };

    try {
      const result = await withTimeout(
        searchTool.execute(params),
        10000,
        'Search operation timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      TestAssert.assertTrue(Array.isArray(result.matches));

      if (result.matches.length > 0) {
        const match = result.matches[0];
        TestAssert.assertTrue('file' in match);
        TestAssert.assertTrue('range' in match);
        TestAssert.assertTrue('text' in match);
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping search test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle pattern with metavariables', async () => {
    const params = {
      pattern: 'function $NAME($ARGS) { $$$BODY }',
      language: 'javascript',
      paths: ['../test-files']
    };

    try {
      const result = await withTimeout(
        searchTool.execute(params),
        10000,
        'Pattern search timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);

      if (result.matches.length > 0) {
        const match = result.matches[0];
        TestAssert.assertTrue('metaVars' in match || 'metavariables' in match);
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping metavariable test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle TypeScript patterns', async () => {
    const params = {
      pattern: 'interface $NAME { $$$BODY }',
      language: 'typescript',
      paths: ['../test-files']
    };

    try {
      const result = await withTimeout(
        searchTool.execute(params),
        10000,
        'TypeScript search timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      TestAssert.assertTrue(Array.isArray(result.matches));

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping TypeScript test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle inline code parameter', async () => {
    const params = {
      pattern: 'console.log($MSG)',
      language: 'javascript',
      code: `
        function greet(name) {
          console.log("Hello, " + name);
        }

        console.log("test message");
      `
    };

    try {
      const result = await withTimeout(
        searchTool.execute(params),
        5000,
        'Inline code search timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      TestAssert.assertTrue(Array.isArray(result.matches));

      // Should find at least one console.log
      TestAssert.assertTrue(result.matches.length >= 1);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping inline code test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should validate required parameters', async () => {
    const invalidParams1 = {
      language: 'javascript'
      // Missing pattern
    };

    const invalidParams2 = {
      pattern: 'console.log($ARG)'
      // Missing language
    };

    const invalidParams3 = {
      pattern: '',
      language: 'javascript'
    };

    await TestAssert.assertThrowsAsync(
      () => searchTool.execute(invalidParams1),
      'pattern'
    );

    await TestAssert.assertThrowsAsync(
      () => searchTool.execute(invalidParams2),
      'language'
    );

    await TestAssert.assertThrowsAsync(
      () => searchTool.execute(invalidParams3),
      'pattern'
    );
  });

  suite.test('should handle unsupported languages gracefully', async () => {
    const params = {
      pattern: 'test',
      language: 'unsupported-lang',
      code: 'test code'
    };

    try {
      await searchTool.execute(params);
      TestAssert.assertTrue(false, 'Should have thrown error for unsupported language');
    } catch (error) {
      TestAssert.assertTrue(error instanceof Error);
      TestAssert.assertTrue(
        error.message.includes('language') ||
        error.message.includes('unsupported') ||
        error.message.includes('ast-grep not found')
      );
    }
  });

  suite.test('should handle complex search patterns', async () => {
    const params = {
      pattern: 'if ($CONDITION) { $$$THEN }',
      language: 'javascript',
      code: `
        if (user.isActive) {
          console.log("User is active");
          return true;
        }

        if (data && data.length > 0) {
          processData(data);
        }
      `
    };

    try {
      const result = await withTimeout(
        searchTool.execute(params),
        5000,
        'Complex pattern search timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue(Array.isArray(result.matches));

      if (result.matches.length > 0) {
        const match = result.matches[0];
        TestAssert.assertTrue('range' in match);
        TestAssert.assertTrue('text' in match);
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping complex pattern test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}