// Comprehensive test framework for tree-ast-grep MCP server
import { AstGrepBinaryManager } from '../build/core/binary-manager.js';
import { WorkspaceManager } from '../build/core/workspace-manager.js';
import { SearchTool } from '../build/tools/search.js';
import { RunRuleTool } from '../build/tools/rule-builder.js';
import { ScanTool } from '../build/tools/scan.js';
import * as path from 'path';
import * as fs from 'fs/promises';

class TestResult {
  constructor(name, passed, message, details = {}) {
    this.name = name;
    this.passed = passed;
    this.message = message;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class TestSuite {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(result) {
    this.results.push(result);
    const status = result.passed ? '✅' : '❌';
    console.log(`  ${status} ${result.name}: ${result.message}`);
    if (!result.passed && Object.keys(result.details).length > 0) {
      console.log(`     Details:`, result.details);
    }
  }

  async runTest(testName, testFn) {
    try {
      const result = await testFn();
      this.addResult(new TestResult(testName, true, result.message || 'Passed', result.details));
      return true;
    } catch (error) {
      this.addResult(new TestResult(testName, false, error.message, {
        stack: error.stack,
        ...error.details
      }));
      return false;
    }
  }

  getSummary() {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const duration = Date.now() - this.startTime;

    return {
      suite: this.name,
      passed,
      failed: total - passed,
      total,
      duration,
      passRate: total > 0 ? (passed / total * 100).toFixed(1) : 0
    };
  }

  printSummary() {
    const summary = this.getSummary();
    console.log(`\n=== ${summary.suite} Summary ===`);
    console.log(`Passed: ${summary.passed}/${summary.total} (${summary.passRate}%)`);
    console.log(`Duration: ${summary.duration}ms`);

    if (summary.failed > 0) {
      console.log(`\n❌ Failed tests:`);
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
    }
  }
}

export class MCPTestFramework {
  constructor() {
    this.binaryManager = null;
    this.workspaceManager = null;
    this.searchTool = null;
    this.scanTool = null;
    this.ruleTool = null;
  }

  async initialize() {
    console.log('🔧 Initializing test framework...');

    this.binaryManager = new AstGrepBinaryManager({ autoInstall: true });
    await this.binaryManager.initialize();
    console.log(`✅ Binary manager initialized: ${this.binaryManager.getBinaryPath()}`);

    this.workspaceManager = new WorkspaceManager();
    console.log(`✅ Workspace manager initialized: ${this.workspaceManager.getWorkspaceRoot()}`);

    this.searchTool = new SearchTool(this.binaryManager, this.workspaceManager);
    this.scanTool = new ScanTool(this.binaryManager, this.workspaceManager);
    this.ruleTool = new RunRuleTool(this.workspaceManager, this.scanTool);
    console.log('✅ All tools initialized');
  }

  async createTestFiles() {
    const testDir = path.join(this.workspaceManager.getWorkspaceRoot(), 'test-files');
    await fs.mkdir(testDir, { recursive: true });

    // Create various test files with different patterns - ensure all files have console.log patterns
    const testFiles = {
      'simple.js': `
console.log("Hello World");
function greet(name) {
  console.log("Hello " + name);
}
var oldVar = "test";
let newVar = "modern";
const CONSTANT = "immutable";
`,
      'complex.js': `
class DataProcessor {
  constructor() {
    this.data = [];
    console.log("DataProcessor initialized");
  }

  process(item) {
    console.log("Processing:", item);
    this.data.push(item);
  }

  async fetchData(url) {
    console.log("Fetching from:", url);
    return fetch(url);
  }
}

function calculateTotal(items) {
  console.log("Calculating total for", items.length, "items");
  return items.reduce((sum, item) => sum + item.value, 0);
}
`,
      'helper.js': `
// Additional JavaScript file to test multiple file scenarios
function debugLog(message) {
  console.log("[DEBUG]", message);
}

function errorLog(error) {
  console.log("[ERROR]", error.message);
}

module.exports = { debugLog, errorLog };
`,
      'nested/deep.js': `
function deepFunction() {
  console.log("Deep nested function");

  if (true) {
    console.log("Inside condition");
  }
}
`
    };

    for (const [filename, content] of Object.entries(testFiles)) {
      const filePath = path.join(testDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content.trim(), 'utf8');
    }

    return testDir;
  }

  // Test file count accuracy between search and rule tools
  async testFileCountAccuracy() {
    const suite = new TestSuite('File Count Accuracy');
    console.log(`\n🧪 Running ${suite.name} tests...`);

    const testDir = await this.createTestFiles();

    const testScenarios = [
      {
        name: 'Single file',
        paths: [path.join(testDir, 'simple.js')],
        expectedMin: 1,
        description: 'Should scan exactly 1 file'
      },
      {
        name: 'Multiple files',
        paths: [path.join(testDir, 'simple.js'), path.join(testDir, 'complex.js')],
        expectedMin: 2,
        description: 'Should scan exactly 2 files'
      },
      {
        name: 'Directory scan',
        paths: [testDir],
        expectedMin: 3,
        description: 'Should scan all JS files in directory (simple.js, complex.js, helper.js, nested/deep.js)'
      },
      {
        name: 'Nested directory',
        paths: [path.join(testDir, 'nested')],
        expectedMin: 1,
        description: 'Should scan 1 file in nested directory'
      }
    ];

    for (const scenario of testScenarios) {
      await suite.runTest(`File count: ${scenario.name}`, async () => {
        const searchResult = await this.searchTool.execute({
          pattern: 'console.log($_)',
          language: 'javascript',
          paths: scenario.paths
        });

        const ruleResult = await this.ruleTool.execute({
          id: 'test-console-log',
          language: 'javascript',
          pattern: 'console.log($_)',
          message: 'Test rule',
          paths: scenario.paths
        });

        const searchFiles = searchResult.summary.filesScanned;
        const ruleFiles = ruleResult.scan.summary.filesScanned;

        if (searchFiles < scenario.expectedMin) {
          throw new Error(`Search tool reported ${searchFiles} files, expected at least ${scenario.expectedMin}`, {
            details: { searchFiles, ruleFiles, expectedMin: scenario.expectedMin }
          });
        }

        if (ruleFiles === 0) {
          throw new Error(`Rule tool reported 0 files scanned (CRITICAL BUG)`, {
            details: { searchFiles, ruleFiles, paths: scenario.paths }
          });
        }

        if (searchFiles !== ruleFiles) {
          throw new Error(`File count mismatch: search=${searchFiles}, rule=${ruleFiles}`, {
            details: { searchFiles, ruleFiles, scenario: scenario.name }
          });
        }

        return {
          message: `Consistent file count: ${searchFiles}`,
          details: { searchFiles, ruleFiles, scenario: scenario.name }
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Test pattern matching consistency
  async testPatternConsistency() {
    const suite = new TestSuite('Pattern Matching Consistency');
    console.log(`\n🧪 Running ${suite.name} tests...`);

    const testDir = await this.createTestFiles();
    const testFile = path.join(testDir, 'simple.js');

    const patterns = [
      { pattern: 'console.log', name: 'Literal pattern' },
      { pattern: 'console.log($_)', name: 'Single metavariable' },
      { pattern: 'console.log($MSG)', name: 'Named metavariable' },
      { pattern: 'function $NAME($ARGS) { $$$ }', name: 'Function pattern' },
      { pattern: 'var $VAR = $VALUE', name: 'Variable declaration' },
      { pattern: 'let $VAR = $VALUE', name: 'Let declaration' },
      { pattern: 'const $VAR = $VALUE', name: 'Const declaration' }
    ];

    for (const { pattern, name } of patterns) {
      await suite.runTest(`Pattern consistency: ${name}`, async () => {
        const searchResult = await this.searchTool.execute({
          pattern,
          language: 'javascript',
          paths: [testFile]
        });

        const ruleResult = await this.ruleTool.execute({
          id: `test-${name.replace(/\s+/g, '-').toLowerCase()}`,
          language: 'javascript',
          pattern,
          message: `Test: ${name}`,
          paths: [testFile]
        });

        const searchMatches = searchResult.matches.length;
        const ruleFindings = ruleResult.scan.findings.length;

        if (searchMatches !== ruleFindings) {
          throw new Error(`Match count mismatch: search=${searchMatches}, rule=${ruleFindings}`, {
            details: {
              pattern,
              searchMatches,
              ruleFindings,
              searchFiles: searchResult.matches.map(m => ({ file: m.file, line: m.line })),
              ruleFiles: ruleResult.scan.findings.map(f => ({ file: f.file, line: f.line }))
            }
          });
        }

        return {
          message: `Consistent matches: ${searchMatches}`,
          details: { pattern, matches: searchMatches }
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Test path resolution robustness
  async testPathResolution() {
    const suite = new TestSuite('Path Resolution');
    console.log(`\n🧪 Running ${suite.name} tests...`);

    const testDir = await this.createTestFiles();
    const testFile = path.join(testDir, 'simple.js');
    const workspaceRoot = this.workspaceManager.getWorkspaceRoot();

    const pathScenarios = [
      {
        name: 'Relative path from workspace',
        path: path.relative(workspaceRoot, testFile),
        shouldWork: true
      },
      {
        name: 'Absolute path',
        path: testFile,
        shouldWork: true
      },
      {
        name: 'Directory path',
        path: testDir,
        shouldWork: true
      },
      {
        name: 'Nonexistent file',
        path: path.join(testDir, 'nonexistent.js'),
        shouldWork: false
      },
      {
        name: 'Path outside workspace',
        path: path.join(path.dirname(workspaceRoot), 'outside.js'),
        shouldWork: false
      }
    ];

    for (const scenario of pathScenarios) {
      await suite.runTest(`Path resolution: ${scenario.name}`, async () => {
        try {
          const validation = this.workspaceManager.validatePath(scenario.path);

          if (scenario.shouldWork && !validation.valid) {
            throw new Error(`Expected path to be valid but got error: ${validation.error}`, {
              details: { path: scenario.path, validation }
            });
          }

          if (!scenario.shouldWork && validation.valid) {
            throw new Error(`Expected path to be invalid but it was accepted`, {
              details: { path: scenario.path, validation }
            });
          }

          return {
            message: scenario.shouldWork ? 'Valid path correctly accepted' : 'Invalid path correctly rejected',
            details: { path: scenario.path, resolved: validation.resolvedPath }
          };
        } catch (error) {
          if (!scenario.shouldWork) {
            // Expected to fail
            return {
              message: 'Invalid path correctly rejected with exception',
              details: { path: scenario.path, error: error.message }
            };
          }
          throw error;
        }
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Test error handling improvements
  async testErrorHandling() {
    const suite = new TestSuite('Error Handling');
    console.log(`\n🧪 Running ${suite.name} tests...`);

    const errorScenarios = [
      {
        name: 'Invalid pattern syntax',
        test: async () => {
          try {
            await this.searchTool.execute({
              pattern: 'invalid pattern [[[',
              language: 'javascript',
              paths: ['test-example.js']
            });
            throw new Error('Should have thrown error for invalid pattern');
          } catch (error) {
            return {
              message: 'Invalid pattern correctly rejected',
              details: { error: error.message }
            };
          }
        }
      },
      {
        name: 'Missing required parameters',
        test: async () => {
          try {
            await this.searchTool.execute({
              language: 'javascript',
              paths: ['test-example.js']
              // Missing pattern
            });
            throw new Error('Should have thrown error for missing pattern');
          } catch (error) {
            return {
              message: 'Missing pattern correctly rejected',
              details: { error: error.message }
            };
          }
        }
      },
      {
        name: 'Unsupported language',
        test: async () => {
          try {
            await this.searchTool.execute({
              pattern: 'test',
              language: 'unsupported-lang',
              paths: ['test-example.js']
            });
            throw new Error('Should have thrown error for unsupported language');
          } catch (error) {
            return {
              message: 'Unsupported language correctly rejected',
              details: { error: error.message }
            };
          }
        }
      }
    ];

    for (const scenario of errorScenarios) {
      await suite.runTest(scenario.name, scenario.test);
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting comprehensive MCP server test suite...\n');

    await this.initialize();

    const results = [];

    // Run test suites in order
    results.push(await this.testFileCountAccuracy());
    results.push(await this.testPatternConsistency());
    results.push(await this.testPathResolution());
    results.push(await this.testErrorHandling());

    // Overall summary
    console.log('\n' + '='.repeat(60));
    console.log('🏁 COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));

    let totalPassed = 0;
    let totalTests = 0;

    results.forEach(result => {
      console.log(`${result.suite}: ${result.passed}/${result.total} (${result.passRate}%) - ${result.duration}ms`);
      totalPassed += result.passed;
      totalTests += result.total;
    });

    const overallRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : 0;
    console.log(`\nOVERALL: ${totalPassed}/${totalTests} (${overallRate}%)`);

    if (totalPassed === totalTests) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`❌ ${totalTests - totalPassed} tests failed`);
      process.exit(1);
    }

    return results;
  }
}

// Export for use in other test files
export { TestSuite, TestResult };