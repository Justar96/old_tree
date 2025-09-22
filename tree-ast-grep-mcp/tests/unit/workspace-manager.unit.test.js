/**
 * Unit tests for WorkspaceManager
 */

import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, MockFileSystem } from '../utils/test-helpers.js';
import path from 'path';

export default async function runWorkspaceManagerTests() {
  const suite = new TestSuite('WorkspaceManager Unit Tests');

  suite.test('should initialize with default workspace', async () => {
    const manager = new WorkspaceManager();

    TestAssert.assertInstanceOf(manager, WorkspaceManager);
    TestAssert.assertTrue(typeof manager.getWorkspaceRoot === 'function');
    TestAssert.assertTrue(typeof manager.validatePath === 'function');
  });

  suite.test('should detect workspace root', async () => {
    const manager = new WorkspaceManager();

    const workspaceRoot = manager.getWorkspaceRoot();
    TestAssert.assertTrue(typeof workspaceRoot === 'string');
    TestAssert.assertTrue(workspaceRoot.length > 0);
    TestAssert.assertTrue(path.isAbsolute(workspaceRoot));
  });

  suite.test('should validate relative paths', async () => {
    const manager = new WorkspaceManager();

    const result = manager.validatePath('src/index.ts');
    TestAssert.assertTrue(typeof result === 'object');
    TestAssert.assertTrue('valid' in result);
    TestAssert.assertTrue('resolvedPath' in result);
    TestAssert.assertTrue(typeof result.resolvedPath === 'string');
  });

  suite.test('should handle absolute paths', async () => {
    const manager = new WorkspaceManager();

    const absolutePath = path.resolve(process.cwd(), 'src', 'index.ts');
    const result = manager.validatePath(absolutePath);

    TestAssert.assertTrue(typeof result === 'object');
    TestAssert.assertTrue('valid' in result);
    TestAssert.assertTrue('resolvedPath' in result);
  });

  suite.test('should validate different path formats', async () => {
    const manager = new WorkspaceManager();

    // Test valid paths
    const validResult = manager.validatePath('src/index.ts');
    TestAssert.assertTrue(typeof validResult === 'object');
    TestAssert.assertTrue('valid' in validResult);

    // Test edge cases
    const emptyResult = manager.validatePath('');
    TestAssert.assertTrue(typeof emptyResult === 'object');
    TestAssert.assertTrue('valid' in emptyResult);
  });

  suite.test('should handle multiple path validation', async () => {
    const manager = new WorkspaceManager();

    const paths = ['src/index.ts', 'src/tools/', 'README.md'];
    const result = manager.validatePaths(paths);

    TestAssert.assertTrue(typeof result === 'object');
    TestAssert.assertTrue('valid' in result);
    TestAssert.assertTrue('resolvedPaths' in result);
    TestAssert.assertTrue('errors' in result);
    TestAssert.assertTrue(Array.isArray(result.resolvedPaths));
    TestAssert.assertTrue(Array.isArray(result.errors));
  });

  suite.test('should handle workspace detection with package.json', async () => {
    const manager = new WorkspaceManager();

    const root = manager.getWorkspaceRoot();
    TestAssert.assertTrue(typeof root === 'string');
    TestAssert.assertTrue(path.isAbsolute(root));

    // Should be in the tree-ast-grep-mcp directory
    TestAssert.assertTrue(root.includes('tree-ast-grep-mcp'));
  });

  suite.test('should validate workspace paths correctly', async () => {
    const manager = new WorkspaceManager();

    const workspaceRoot = manager.getWorkspaceRoot();
    const testPath = path.join(workspaceRoot, 'src', 'index.ts');
    const result = manager.validatePath(testPath);

    TestAssert.assertTrue(typeof result === 'object');
    TestAssert.assertTrue('valid' in result);
    TestAssert.assertTrue('resolvedPath' in result);
  });

  suite.test('should handle explicit workspace root', async () => {
    const explicitRoot = process.cwd();
    const manager = new WorkspaceManager(explicitRoot);

    const root = manager.getWorkspaceRoot();
    TestAssert.assertTrue(typeof root === 'string');
    TestAssert.assertTrue(path.isAbsolute(root));
  });

  return suite.run();
}