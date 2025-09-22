/**
 * Integration tests for ReplaceTool
 */

import { ReplaceTool } from '../../build/tools/replace.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runReplaceToolIntegrationTests() {
  const suite = new TestSuite('ReplaceTool Integration Tests');

  let binaryManager;
  let workspaceManager;
  let replaceTool;
  let tempDir;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    replaceTool = new ReplaceTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-test-'));
  });

  suite.afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  suite.test('should replace console.log with logger.info using inline code', async () => {
    const params = {
      pattern: 'console.log($ARG)',
      replacement: 'logger.info($ARG)',
      language: 'javascript',
      code: `
        function greet(name) {
          console.log("Hello, " + name);
        }

        console.log("test message");
        console.error("error message");
      `
    };

    try {
      const result = await withTimeout(
        replaceTool.execute(params),
        5000,
        'Replace operation timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('modified' in result || 'code' in result || 'diff' in result);

      if ('code' in result) {
        TestAssert.assertContains(result.code, 'logger.info');
        TestAssert.assertNotContains(result.code, 'console.log');
        // console.error should remain unchanged
        TestAssert.assertContains(result.code, 'console.error');
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping replace test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle function signature replacement', async () => {
    const params = {
      pattern: 'function $NAME($ARGS) { $$$BODY }',
      replacement: 'const $NAME = ($ARGS) => { $$$BODY }',
      language: 'javascript',
      code: `
        function greet(name) {
          return "Hello, " + name;
        }

        function calculate(a, b) {
          return a + b;
        }
      `
    };

    try {
      const result = await withTimeout(
        replaceTool.execute(params),
        5000,
        'Function replacement timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

      if ('code' in result) {
        TestAssert.assertContains(result.code, 'const greet = ');
        TestAssert.assertContains(result.code, 'const calculate = ');
        TestAssert.assertContains(result.code, '=>');
        TestAssert.assertNotContains(result.code, 'function greet');
        TestAssert.assertNotContains(result.code, 'function calculate');
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping function replacement test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle TypeScript interface updates', async () => {
    const params = {
      pattern: 'interface $NAME { $$$PROPS }',
      replacement: 'type $NAME = { $$$PROPS }',
      language: 'typescript',
      code: `
        interface User {
          name: string;
          age: number;
        }

        interface Config {
          debug: boolean;
        }
      `
    };

    try {
      const result = await withTimeout(
        replaceTool.execute(params),
        5000,
        'TypeScript replacement timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

      if ('code' in result) {
        TestAssert.assertContains(result.code, 'type User =');
        TestAssert.assertContains(result.code, 'type Config =');
        TestAssert.assertNotContains(result.code, 'interface User');
        TestAssert.assertNotContains(result.code, 'interface Config');
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping TypeScript replacement test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should validate required parameters', async () => {
    const invalidParams1 = {
      replacement: 'logger.info($ARG)',
      language: 'javascript'
      // Missing pattern
    };

    const invalidParams2 = {
      pattern: 'console.log($ARG)',
      language: 'javascript'
      // Missing replacement
    };

    const invalidParams3 = {
      pattern: 'console.log($ARG)',
      replacement: 'logger.info($ARG)'
      // Missing language
    };

    await TestAssert.assertThrowsAsync(
      () => replaceTool.execute(invalidParams1),
      'pattern'
    );

    await TestAssert.assertThrowsAsync(
      () => replaceTool.execute(invalidParams2),
      'replacement'
    );

    await TestAssert.assertThrowsAsync(
      () => replaceTool.execute(invalidParams3),
      'language'
    );
  });

  suite.test('should handle file-based replacement', async () => {
    // Create a test file
    const testFilePath = path.join(tempDir, 'test-replace.js');
    const testContent = `
function oldFunction(param) {
  console.log("Old function: " + param);
}

function anotherOldFunction(x, y) {
  return x + y;
}
`;

    await fs.writeFile(testFilePath, testContent);

    const params = {
      pattern: 'function $NAME($ARGS) { $$$BODY }',
      replacement: 'const $NAME = ($ARGS) => { $$$BODY }',
      language: 'javascript',
      paths: [testFilePath]
    };

    try {
      const result = await withTimeout(
        replaceTool.execute(params),
        5000,
        'File replacement timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('modified' in result || 'files' in result || 'changes' in result);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping file replacement test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle no matches gracefully', async () => {
    const params = {
      pattern: 'nonExistentPattern($ARG)',
      replacement: 'replacement($ARG)',
      language: 'javascript',
      code: `
        function test() {
          console.log("hello");
        }
      `
    };

    try {
      const result = await withTimeout(
        replaceTool.execute(params),
        5000,
        'No matches test timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

      // Should handle gracefully - either empty changes or original code
      if ('code' in result) {
        TestAssert.assertContains(result.code, 'console.log("hello")');
      }

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping no matches test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}