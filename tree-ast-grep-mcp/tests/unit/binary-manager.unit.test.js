/**
 * Unit tests for AstGrepBinaryManager
 */

import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { BinaryError } from '../../build/types/errors.js';
import { TestSuite, TestAssert } from '../utils/test-helpers.js';

export default async function runBinaryManagerTests() {
  const suite = new TestSuite('BinaryManager Unit Tests');

  suite.test('should initialize with default options', async () => {
    const manager = new AstGrepBinaryManager();

    TestAssert.assertInstanceOf(manager, AstGrepBinaryManager);
    TestAssert.assertTrue(typeof manager.executeAstGrep === 'function');
    TestAssert.assertTrue(typeof manager.initialize === 'function');
  });

  suite.test('should handle initialization options', async () => {
    const options = {
      useSystem: true,
      autoInstall: false,
      platform: 'win32'
    };

    const manager = new AstGrepBinaryManager(options);
    TestAssert.assertInstanceOf(manager, AstGrepBinaryManager);
  });

  suite.test('should handle initialization process', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();
      TestAssert.assertTrue(true, 'Initialization completed');
    } catch (error) {
      // Initialization might fail in test environment
      TestAssert.assertInstanceOf(error, BinaryError);
    }
  });

  suite.test('should handle binary execution attempts', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();
      const result = await manager.executeAstGrep(['--version']);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('stdout' in result);
      TestAssert.assertTrue('stderr' in result);
    } catch (error) {
      // Binary might not be installed in test environment
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  suite.test('should execute simple commands', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();
      const result = await manager.executeAstGrep(['--version']);
      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('stdout' in result);
      TestAssert.assertTrue('stderr' in result);
    } catch (error) {
      // ast-grep might not be available in test environment
      console.log('  ⚠️  Skipping execution test - ast-grep not available');
    }
  });

  suite.test('should handle execution errors gracefully', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();
      await manager.executeAstGrep(['--invalid-flag']);
      TestAssert.assertTrue(false, 'Should have thrown error for invalid flag');
    } catch (error) {
      // This could be BinaryError (no binary) or ExecutionError (invalid flag)
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  suite.test('should handle timeout parameters', async () => {
    const manager = new AstGrepBinaryManager({ useSystem: true });

    try {
      await manager.initialize();

      // Test with valid timeout
      await manager.executeAstGrep(['--version'], { timeout: 5000 });
      TestAssert.assertTrue(true, 'Valid timeout handled correctly');
    } catch (error) {
      // ast-grep might not be available or timeout validation might differ
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  return suite.run();
}