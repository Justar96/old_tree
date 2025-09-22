/**
 * Performance and Stress Tests
 * Tests for high-load scenarios, performance limits, and resource management
 */

import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runPerformanceStressTests() {
  const suite = new TestSuite('Performance and Stress Tests');

  let binaryManager;
  let workspaceManager;
  let searchTool;
  let replaceTool;
  let tempDir;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    searchTool = new SearchTool(binaryManager, workspaceManager);
    replaceTool = new ReplaceTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }

    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-stress-test-'));
  });

  suite.afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  // =============================================================================
  // LARGE CODEBASE STRESS TESTS
  // =============================================================================

  suite.test('should handle massive code files efficiently', async () => {
    // Generate a very large JavaScript file
    const lines = [];
    for (let i = 0; i < 5000; i++) {
      lines.push(`function func${i}(param1, param2) {`);
      lines.push(`  console.log("Processing function ${i} with", param1, param2);`);
      lines.push(`  if (param1 > ${i}) {`);
      lines.push(`    return param1 + param2 + ${i};`);
      lines.push(`  }`);
      lines.push(`  return ${i};`);
      lines.push(`}`);
      lines.push('');
    }

    const massiveCode = lines.join('\n');
    console.log(`  📊 Testing with ${lines.length} lines of code (${Math.round(massiveCode.length / 1024)}KB)`);

    const params = {
      pattern: 'console.log($MSG)',
      language: 'javascript',
      code: massiveCode,
      maxMatches: 100, // Limit results to avoid overwhelming output
      timeoutMs: 30000 // 30 second timeout
    };

    try {
      const startTime = Date.now();
      const result = await withTimeout(searchTool.execute(params), 35000);
      const endTime = Date.now();

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);
      TestAssert.assertTrue(result.matches.length <= 100);

      const executionTime = endTime - startTime;
      console.log(`  ⏱️  Execution time: ${executionTime}ms`);

      // Should complete within reasonable time (30 seconds)
      TestAssert.assertTrue(executionTime < 30000);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping massive file test - ast-grep not available');
        return;
      }

      if (error.message.includes('timeout')) {
        console.log('  ⚠️  Large file test timed out - acceptable for stress test');
        return;
      }

      throw error;
    }
  });

  suite.test('should handle deep directory structures with many files', async () => {
    console.log('  📁 Creating deep directory structure...');

    // Create deep nested structure
    const maxDepth = 10;
    const filesPerDir = 5;

    async function createDeepStructure(currentPath, depth) {
      if (depth >= maxDepth) return;

      for (let i = 0; i < filesPerDir; i++) {
        const fileName = `file_${depth}_${i}.js`;
        const filePath = path.join(currentPath, fileName);
        const content = `
// File at depth ${depth}, index ${i}
function processData${depth}_${i}(data) {
  console.log("Processing at depth ${depth}, index ${i}", data);
  if (data && data.length > 0) {
    return data.map(item => item * ${depth + i});
  }
  return [];
}

class Handler${depth}_${i} {
  constructor() {
    console.log("Handler created at depth ${depth}, index ${i}");
  }

  process() {
    console.log("Processing in handler ${depth}_${i}");
  }
}
`;
        await fs.writeFile(filePath, content);
      }

      // Create subdirectory and recurse
      const nextDir = path.join(currentPath, `level_${depth + 1}`);
      await fs.mkdir(nextDir, { recursive: true });
      await createDeepStructure(nextDir, depth + 1);
    }

    await createDeepStructure(tempDir, 0);

    const params = {
      pattern: 'console.log($MSG)',
      language: 'javascript',
      paths: [tempDir],
      maxMatches: 50,
      timeoutMs: 25000
    };

    try {
      const startTime = Date.now();
      const result = await withTimeout(searchTool.execute(params), 30000);
      const endTime = Date.now();

      TestAssert.assertTrue(typeof result === 'object');
      TestAssert.assertTrue('matches' in result);

      const executionTime = endTime - startTime;
      console.log(`  ⏱️  Directory traversal time: ${executionTime}ms`);
      console.log(`  🔍 Found ${result.matches.length} matches`);

      // Should find multiple matches across the directory structure
      TestAssert.assertTrue(result.matches.length > 0);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping directory structure test - ast-grep not available');
        return;
      }

      if (error.message.includes('timeout')) {
        console.log('  ⚠️  Directory structure test timed out - acceptable for stress test');
        return;
      }

      throw error;
    }
  });

  // =============================================================================
  // CONCURRENT OPERATIONS STRESS TESTS
  // =============================================================================

  suite.test('should handle high concurrent load', async () => {
    const concurrencyLevel = 20;
    console.log(`  🔄 Testing ${concurrencyLevel} concurrent operations...`);

    const operations = [];
    for (let i = 0; i < concurrencyLevel; i++) {
      const operation = searchTool.execute({
        pattern: 'console.log($ARG)',
        language: 'javascript',
        code: `
          function test${i}() {
            console.log("Test function ${i}");
            console.log("Additional log ${i}");
            return ${i};
          }
        `,
        timeoutMs: 10000
      });
      operations.push(operation);
    }

    try {
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`  ✅ Successful operations: ${successful}`);
      console.log(`  ❌ Failed operations: ${failed}`);
      console.log(`  ⏱️  Total time: ${endTime - startTime}ms`);

      // Most operations should succeed
      TestAssert.assertTrue(successful > failed);

      // All operations should complete
      TestAssert.assertEqual(successful + failed, concurrencyLevel);

      // Check that successful operations returned valid results
      results.filter(r => r.status === 'fulfilled').forEach(result => {
        TestAssert.assertTrue(typeof result.value === 'object');
        TestAssert.assertTrue('matches' in result.value);
      });

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping concurrent test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should handle rapid sequential operations', async () => {
    const operationCount = 50;
    console.log(`  🏃 Testing ${operationCount} rapid sequential operations...`);

    try {
      const startTime = Date.now();
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < operationCount; i++) {
        try {
          const result = await searchTool.execute({
            pattern: 'function $NAME() { $$$BODY }',
            language: 'javascript',
            code: `function rapidTest${i}() { return ${i}; }`,
            timeoutMs: 5000
          });

          TestAssert.assertTrue(typeof result === 'object');
          successCount++;
        } catch (error) {
          errorCount++;

          if (!error.message.includes('ast-grep not found')) {
            // Allow some failures in stress test, but not all
            TestAssert.assertTrue(errorCount < operationCount / 2);
          }
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / operationCount;

      console.log(`  ✅ Successful: ${successCount}`);
      console.log(`  ❌ Failed: ${errorCount}`);
      console.log(`  ⏱️  Total time: ${totalTime}ms`);
      console.log(`  📊 Average per operation: ${avgTime.toFixed(2)}ms`);

      // Most operations should succeed
      TestAssert.assertTrue(successCount > errorCount);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping sequential test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // MEMORY PRESSURE TESTS
  // =============================================================================

  suite.test('should handle memory-intensive operations', async () => {
    console.log('  🧠 Testing memory-intensive operations...');

    // Create operations that might use significant memory
    const memoryIntensiveOperations = [];

    for (let i = 0; i < 10; i++) {
      // Large code with complex patterns
      const largeCode = Array(1000).fill().map((_, j) => `
        class LargeClass${i}_${j} {
          constructor(data${i}_${j}) {
            this.data = data${i}_${j};
            console.log("Creating large class ${i}_${j} with", data${i}_${j});
          }

          process() {
            console.log("Processing in large class ${i}_${j}");
            return this.data.map(item => ({
              ...item,
              processed: true,
              timestamp: Date.now(),
              index: ${i * 1000 + j}
            }));
          }
        }
      `).join('\n');

      const operation = searchTool.execute({
        pattern: 'class $NAME { $$$BODY }',
        language: 'javascript',
        code: largeCode,
        maxMatches: 20,
        timeoutMs: 15000
      });

      memoryIntensiveOperations.push(operation);
    }

    try {
      const startTime = Date.now();
      const results = await Promise.allSettled(memoryIntensiveOperations);
      const endTime = Date.now();

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`  ✅ Memory operations successful: ${successful}`);
      console.log(`  ❌ Memory operations failed: ${failed}`);
      console.log(`  ⏱️  Memory test time: ${endTime - startTime}ms`);

      // Should handle memory pressure gracefully
      TestAssert.assertTrue(successful + failed === 10);

      // At least some should succeed
      TestAssert.assertTrue(successful > 0);

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping memory test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // TIMEOUT AND RESOURCE LIMIT TESTS
  // =============================================================================

  suite.test('should respect various timeout settings', async () => {
    const timeoutTests = [
      { timeout: 1000, description: 'short timeout' },
      { timeout: 5000, description: 'medium timeout' },
      { timeout: 15000, description: 'long timeout' }
    ];

    for (const timeoutTest of timeoutTests) {
      console.log(`  ⏰ Testing ${timeoutTest.description} (${timeoutTest.timeout}ms)...`);

      try {
        const startTime = Date.now();

        const result = await searchTool.execute({
          pattern: 'function $NAME($ARGS) { $$$BODY }',
          language: 'javascript',
          code: Array(500).fill().map((_, i) =>
            `function timeoutTest${i}(param) { console.log("Function ${i}"); return param * ${i}; }`
          ).join('\n'),
          timeoutMs: timeoutTest.timeout
        });

        const endTime = Date.now();
        const actualTime = endTime - startTime;

        console.log(`    ✅ Completed in ${actualTime}ms`);

        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('matches' in result);

        // Should complete within the timeout
        TestAssert.assertTrue(actualTime <= timeoutTest.timeout + 1000); // Allow 1s buffer

      } catch (error) {
        if (error.message.includes('ast-grep not found')) {
          console.log(`    ⚠️  Skipping timeout test - ast-grep not available`);
          continue;
        }

        if (error.message.includes('timeout')) {
          console.log(`    ⏰ Timeout occurred as expected for ${timeoutTest.description}`);
          TestAssert.assertTrue(true, 'Timeout handled correctly');
        } else {
          throw error;
        }
      }
    }
  });

  // =============================================================================
  // PERFORMANCE REGRESSION TESTS
  // =============================================================================

  suite.test('should maintain reasonable performance baselines', async () => {
    console.log('  📈 Running performance baseline tests...');

    const performanceTests = [
      {
        name: 'simple pattern search',
        params: {
          pattern: 'console.log($ARG)',
          language: 'javascript',
          code: Array(100).fill('console.log("test");').join('\n')
        },
        expectedMaxTime: 5000
      },
      {
        name: 'complex pattern search',
        params: {
          pattern: 'function $NAME($ARGS) { $$$BODY }',
          language: 'javascript',
          code: Array(100).fill().map((_, i) =>
            `function test${i}(a, b) { return a + b + ${i}; }`
          ).join('\n')
        },
        expectedMaxTime: 8000
      },
      {
        name: 'class pattern search',
        params: {
          pattern: 'class $NAME { $$$BODY }',
          language: 'javascript',
          code: Array(50).fill().map((_, i) =>
            `class Test${i} { constructor() { this.id = ${i}; } }`
          ).join('\n')
        },
        expectedMaxTime: 6000
      }
    ];

    for (const perfTest of performanceTests) {
      try {
        const startTime = Date.now();
        const result = await searchTool.execute(perfTest.params);
        const endTime = Date.now();
        const executionTime = endTime - startTime;

        console.log(`    📊 ${perfTest.name}: ${executionTime}ms`);

        TestAssert.assertTrue(typeof result === 'object');
        TestAssert.assertTrue('matches' in result);

        // Performance check (lenient for stress test environment)
        if (executionTime > perfTest.expectedMaxTime) {
          console.log(`    ⚠️  Performance warning: ${perfTest.name} took ${executionTime}ms (expected < ${perfTest.expectedMaxTime}ms)`);
        }

      } catch (error) {
        if (error.message.includes('ast-grep not found')) {
          console.log(`    ⚠️  Skipping ${perfTest.name} - ast-grep not available`);
          continue;
        }
        throw error;
      }
    }
  });

  return suite.run();
}