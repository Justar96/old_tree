/**
 * Integration tests for ScanTool
 */

import { ScanTool } from '../../build/tools/scan.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runScanToolIntegrationTests() {
  const suite = new TestSuite('ScanTool Integration Tests');

  let binaryManager;
  let workspaceManager;
  let scanTool;
  let tempDir;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    scanTool = new ScanTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-scan-test-'));
  });

  suite.afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  suite.test('should scan with YAML rule string', async () => {
    const ruleYaml = `
rule:
  pattern: console.log($ARG)
  language: javascript
message: "Found console.log usage"
severity: warning
`;

    const params = {
      rule: ruleYaml,
      paths: ['../test-files']
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        10000,
        'YAML rule scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result || 'findings' in result || 'results' in result);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping YAML rule test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should scan with rule file', async () => {
    // Create a test rule file
    const ruleFile = path.join(tempDir, 'test-rule.yml');
    const ruleContent = `
rule:
  pattern: function $NAME($ARGS) { $$$BODY }
  language: javascript
message: "Found function declaration"
severity: info
`;

    await fs.writeFile(ruleFile, ruleContent);

    const params = {
      ruleFile: ruleFile,
      paths: ['../test-files']
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        10000,
        'Rule file scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping rule file test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should scan inline code with rule', async () => {
    const ruleYaml = `
rule:
  pattern: if ($CONDITION) { $$$BODY }
  language: javascript
message: "Found if statement"
severity: info
`;

    const params = {
      rule: ruleYaml,
      code: `
        function test(user) {
          if (user.isActive) {
            console.log("User is active");
            return true;
          }

          if (user.age > 18) {
            console.log("User is adult");
          }
        }
      `
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        5000,
        'Inline code scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping inline code scan test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle multiple rule format', async () => {
    const multiRuleYaml = `
rules:
  - rule:
      pattern: console.log($ARG)
      language: javascript
    message: "Found console.log"
    severity: warning

  - rule:
      pattern: console.error($ARG)
      language: javascript
    message: "Found console.error"
    severity: error
`;

    const params = {
      rule: multiRuleYaml,
      code: `
        console.log("debug message");
        console.error("error message");
        console.warn("warning message");
      `
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        5000,
        'Multi-rule scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping multi-rule test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should validate required parameters', async () => {
    const invalidParams1 = {
      paths: ['test']
      // Missing rule and ruleFile
    };

    const invalidParams2 = {
      rule: '',
      paths: ['test']
    };

    const invalidParams3 = {
      rule: 'invalid yaml content {{{}',
      code: 'test code'
    };

    await TestAssert.assertThrowsAsync(
      () => scanTool.execute(invalidParams1),
      'rule'
    );

    await TestAssert.assertThrowsAsync(
      () => scanTool.execute(invalidParams2),
      'rule'
    );

    // Invalid YAML might be caught by ast-grep, not our validation
    try {
      await scanTool.execute(invalidParams3);
    } catch (error) {
      TestAssert.assertTrue(error instanceof Error);
    }
  });

  suite.test('should handle TypeScript rules', async () => {
    const tsRuleYaml = `
rule:
  pattern: interface $NAME { $$$PROPS }
  language: typescript
message: "Found interface declaration"
severity: info
`;

    const params = {
      rule: tsRuleYaml,
      code: `
        interface User {
          name: string;
          age: number;
        }

        interface Config {
          debug: boolean;
          version: string;
        }

        type Status = 'active' | 'inactive';
      `
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        5000,
        'TypeScript rule scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping TypeScript rule test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle complex scanning rules', async () => {
    const complexRuleYaml = `
rule:
  any:
    - pattern: function $NAME($ARGS) { $$$BODY }
    - pattern: const $NAME = ($ARGS) => { $$$BODY }
    - pattern: ($ARGS) => { $$$BODY }
  language: javascript
message: "Found function definition"
severity: info
constraints:
  NAME:
    regex: "^[a-z][a-zA-Z0-9]*$"
`;

    const params = {
      rule: complexRuleYaml,
      code: `
        function regularFunction(param) {
          return param * 2;
        }

        const arrowFunction = (x, y) => {
          return x + y;
        }

        const lambda = (n) => { return n * n; }
      `
    };

    try {
      const result = await withTimeout(
        scanTool.execute(params),
        5000,
        'Complex rule scan timed out'
      );

      TestAssert.assertTrue(typeof result === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping complex rule test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}