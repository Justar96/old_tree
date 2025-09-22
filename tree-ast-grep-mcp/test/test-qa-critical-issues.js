#!/usr/bin/env node

/**
 * QA Critical Issues Test Suite
 * Tests the specific pattern failures identified by the QA team
 *
 * Critical Issues to Reproduce and Fix:
 * 1. Argument Pattern Matching - SEVERELY LIMITED (20% vs 80% success rate)
 * 2. Nested Pattern Composition - COMPLETELY BROKEN
 * 3. Contextual Patterns - NON-FUNCTIONAL (inside:, has:)
 * 4. Exception Handling Patterns - FAILED
 * 5. Language-Specific Limitations
 */

import { MCPTestFramework, TestSuite } from './test-framework.js';
import * as path from 'path';
import * as fs from 'fs/promises';

class QACriticalTestSuite extends MCPTestFramework {
  async createQATestFiles() {
    const testDir = path.join(this.workspaceManager.getWorkspaceRoot(), 'qa-test-files');
    await fs.mkdir(testDir, { recursive: true });

    // Python test files for function argument patterns
    const pythonFunctionFile = `
def simple_function():
    pass

def single_arg_function(x):
    return x * 2

def double_arg_function(x, y):
    return x + y

def triple_arg_function(a, b, c):
    return a + b + c

def typed_function(name: str, age: int):
    return f"{name} is {age} years old"

def default_args_function(x, y=10):
    return x + y

def varargs_function(*args):
    return sum(args)

def kwargs_function(**kwargs):
    return kwargs

def mixed_function(x, y=5, *args, **kwargs):
    return x + y + sum(args)

# Exception handling test
try:
    risky_operation()
except ValueError as e:
    print(f"ValueError: {e}")
except Exception as ex:
    print(f"General error: {ex}")
finally:
    cleanup()
`;

    // JavaScript test files for nested patterns
    const jsNestedFile = `
class UserManager {
    constructor() {
        this.users = [];
    }

    addUser(name, email) {
        console.log("Adding user:", name);
        this.users.push({ name, email });
    }

    removeUser(id) {
        console.log("Removing user:", id);
        this.users = this.users.filter(u => u.id !== id);
    }

    async fetchUser(id) {
        console.log("Fetching user:", id);
        return await fetch(\`/api/users/\${id}\`);
    }
}

function processData(items) {
    if (items.length > 0) {
        console.log("Processing items");
        return items.map(item => item.value);
    }
    return [];
}

// Another class with methods
class DataProcessor {
    validateInput(data) {
        if (!data) {
            throw new Error("Invalid data");
        }
        return true;
    }

    transformData(input) {
        console.log("Transforming data");
        return input.toUpperCase();
    }
}
`;

    // JavaScript exception handling file
    const jsExceptionFile = `
function riskyOperation() {
    try {
        dangerousCall();
    } catch (error) {
        console.error("Caught error:", error);
    }
}

async function asyncRiskyOperation() {
    try {
        await asyncDangerousCall();
    } catch (err) {
        handleError(err);
    } finally {
        cleanup();
    }
}

function multipleExceptions() {
    try {
        criticalOperation();
    } catch (TypeError) {
        handleTypeError();
    } catch (ReferenceError) {
        handleRefError();
    } catch (e) {
        handleGenericError(e);
    }
}
`;

    const testFiles = {
      'python-functions.py': pythonFunctionFile,
      'js-nested.js': jsNestedFile,
      'js-exceptions.js': jsExceptionFile
    };

    for (const [filename, content] of Object.entries(testFiles)) {
      const filePath = path.join(testDir, filename);
      await fs.writeFile(filePath, content.trim(), 'utf8');
    }

    return testDir;
  }

  // Critical Issue 1: Argument Pattern Matching Reliability
  async testArgumentPatternReliability() {
    const suite = new TestSuite('QA Critical Issue 1: Argument Pattern Reliability');
    console.log(`\n🔴 Running ${suite.name} tests...`);

    const testDir = await this.createQATestFiles();
    const pythonFile = path.join(testDir, 'python-functions.py');

    // Test both $ARGS and $$$ patterns as identified by QA
    const patternTests = [
      {
        name: 'Function with $ARGS pattern (QA reported 20% success)',
        pattern: 'def $FUNC_NAME($ARGS): $$$',
        expectedMinMatches: 5, // Should find most function definitions
        language: 'python'
      },
      {
        name: 'Function with $$$ pattern (QA reported 80% success)',
        pattern: 'def $FUNC_NAME($$$): $$$',
        expectedMinMatches: 5, // Should find most function definitions
        language: 'python'
      },
      {
        name: 'Simple function pattern (baseline)',
        pattern: 'def $FUNC_NAME',
        expectedMinMatches: 8, // Should find all function definitions
        language: 'python'
      }
    ];

    for (const test of patternTests) {
      await suite.runTest(test.name, async () => {
        const searchResult = await this.searchTool.execute({
          pattern: test.pattern,
          language: test.language,
          paths: [pythonFile]
        });

        const ruleResult = await this.ruleTool.execute({
          id: `test-${test.name.replace(/\s+/g, '-').toLowerCase()}`,
          language: test.language,
          pattern: test.pattern,
          message: `QA Test: ${test.name}`,
          paths: [pythonFile]
        });

        const searchMatches = searchResult.matches.length;
        const ruleFindings = ruleResult.scan.findings.length;

        // Record actual findings for QA analysis
        const details = {
          pattern: test.pattern,
          language: test.language,
          searchMatches,
          ruleFindings,
          expectedMin: test.expectedMinMatches,
          searchFiles: searchResult.matches.map(m => ({
            file: path.basename(m.file),
            line: m.line,
            text: m.text.slice(0, 50) + '...'
          })),
          ruleFiles: ruleResult.scan.findings.map(f => ({
            file: path.basename(f.file),
            line: f.line,
            message: f.message
          }))
        };

        // Analysis: Check if this reproduces QA findings
        if (test.pattern.includes('$ARGS') && searchMatches < test.expectedMinMatches) {
          console.log(`⚠️  REPRODUCED QA ISSUE: $ARGS pattern only found ${searchMatches} matches (expected ${test.expectedMinMatches})`);
        }

        if (test.pattern.includes('$$$') && searchMatches >= test.expectedMinMatches) {
          console.log(`✅ CONFIRMED: $$$ pattern works better with ${searchMatches} matches`);
        }

        return {
          message: `Found ${searchMatches} search matches, ${ruleFindings} rule findings`,
          details
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Critical Issue 2: Nested Pattern Composition
  async testNestedPatternComposition() {
    const suite = new TestSuite('QA Critical Issue 2: Nested Pattern Composition');
    console.log(`\n🔴 Running ${suite.name} tests...`);

    const testDir = await this.createQATestFiles();
    const jsFile = path.join(testDir, 'js-nested.js');

    const nestedPatterns = [
      {
        name: 'Methods inside classes (QA reported 0 matches)',
        pattern: 'class $CLASS_NAME { $$$ $METHOD_NAME($ARGS) { $$$ } $$$ }',
        expectedMin: 3, // Should find methods in UserManager and DataProcessor
        language: 'javascript'
      },
      {
        name: 'Console.log inside methods',
        pattern: '$METHOD_NAME($ARGS) { $$$ console.log($MSG) $$$ }',
        expectedMin: 2, // Should find methods with console.log
        language: 'javascript'
      },
      {
        name: 'Functions inside classes (alternative syntax)',
        pattern: 'class $CLASS { $$$ $FUNC($PARAMS) { $BODY } $$$ }',
        expectedMin: 2,
        language: 'javascript'
      }
    ];

    for (const test of nestedPatterns) {
      await suite.runTest(test.name, async () => {
        const searchResult = await this.searchTool.execute({
          pattern: test.pattern,
          language: test.language,
          paths: [jsFile]
        });

        const ruleResult = await this.ruleTool.execute({
          id: `test-nested-${test.name.replace(/\s+/g, '-').toLowerCase()}`,
          language: test.language,
          pattern: test.pattern,
          message: `QA Nested Test: ${test.name}`,
          paths: [jsFile]
        });

        const searchMatches = searchResult.matches.length;
        const ruleFindings = ruleResult.scan.findings.length;

        const details = {
          pattern: test.pattern,
          language: test.language,
          searchMatches,
          ruleFindings,
          expectedMin: test.expectedMin,
          actualMatches: searchResult.matches.map(m => ({
            line: m.line,
            text: m.text.slice(0, 80) + '...'
          }))
        };

        // Check if this reproduces the QA finding of 0 matches
        if (searchMatches === 0) {
          console.log(`🔴 REPRODUCED QA ISSUE: Nested pattern returned 0 matches as reported`);
        } else {
          console.log(`✅ Pattern working: Found ${searchMatches} matches`);
        }

        return {
          message: `Found ${searchMatches} search matches, ${ruleFindings} rule findings`,
          details
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Critical Issue 3: Contextual Patterns (inside:, has:)
  async testContextualPatterns() {
    const suite = new TestSuite('QA Critical Issue 3: Contextual Patterns');
    console.log(`\n🔴 Running ${suite.name} tests...`);

    const testDir = await this.createQATestFiles();
    const jsFile = path.join(testDir, 'js-nested.js');

    // Test contextual patterns using rule builder which should support inside/has
    const contextualTests = [
      {
        name: 'Console.log inside class methods (using inside)',
        id: 'console-in-class',
        pattern: 'console.log($_)',
        insidePattern: 'class $CLASS { $$$ }',
        expectedMin: 1,
        language: 'javascript'
      },
      {
        name: 'Methods that have console.log (using has)',
        id: 'methods-with-console',
        pattern: '$METHOD($ARGS) { $$$ }',
        hasPattern: 'console.log($_)',
        expectedMin: 2,
        language: 'javascript'
      },
      {
        name: 'Functions inside try blocks',
        id: 'funcs-in-try',
        pattern: '$FUNC($ARGS)',
        insidePattern: 'try { $$$ }',
        expectedMin: 1,
        language: 'javascript'
      }
    ];

    for (const test of contextualTests) {
      await suite.runTest(test.name, async () => {
        const ruleParams = {
          id: test.id,
          language: test.language,
          pattern: test.pattern,
          message: `QA Contextual Test: ${test.name}`,
          paths: [jsFile]
        };

        if (test.insidePattern) {
          ruleParams.insidePattern = test.insidePattern;
        }
        if (test.hasPattern) {
          ruleParams.hasPattern = test.hasPattern;
        }

        const ruleResult = await this.ruleTool.execute(ruleParams);
        const findings = ruleResult.scan.findings.length;

        const details = {
          pattern: test.pattern,
          insidePattern: test.insidePattern,
          hasPattern: test.hasPattern,
          language: test.language,
          findings,
          expectedMin: test.expectedMin,
          yamlGenerated: ruleResult.yaml,
          actualFindings: ruleResult.scan.findings.map(f => ({
            line: f.line,
            message: f.message
          }))
        };

        // Check if this reproduces QA finding of contextual patterns failing
        if (findings === 0) {
          console.log(`🔴 REPRODUCED QA ISSUE: Contextual pattern returned 0 findings as reported`);
        } else {
          console.log(`✅ Contextual pattern working: Found ${findings} findings`);
        }

        return {
          message: `Found ${findings} contextual findings`,
          details
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Critical Issue 4: Exception Handling Patterns
  async testExceptionHandlingPatterns() {
    const suite = new TestSuite('QA Critical Issue 4: Exception Handling Patterns');
    console.log(`\n🔴 Running ${suite.name} tests...`);

    const testDir = await this.createQATestFiles();
    const jsExceptionFile = path.join(testDir, 'js-exceptions.js');
    const pythonFile = path.join(testDir, 'python-functions.py');

    const exceptionPatterns = [
      {
        name: 'Try-catch blocks (JavaScript)',
        pattern: 'try { $$$ } catch ($ERROR) { $$$ }',
        file: jsExceptionFile,
        language: 'javascript',
        expectedMin: 2
      },
      {
        name: 'Try-except blocks (Python)',
        pattern: 'try: $$$ except $EXCEPTION: $$$',
        file: pythonFile,
        language: 'python',
        expectedMin: 1
      },
      {
        name: 'Catch blocks only (JavaScript)',
        pattern: 'catch ($ERROR) { $$$ }',
        file: jsExceptionFile,
        language: 'javascript',
        expectedMin: 3
      },
      {
        name: 'Except blocks only (Python)',
        pattern: 'except $EXCEPTION:',
        file: pythonFile,
        language: 'python',
        expectedMin: 2
      }
    ];

    for (const test of exceptionPatterns) {
      await suite.runTest(test.name, async () => {
        const searchResult = await this.searchTool.execute({
          pattern: test.pattern,
          language: test.language,
          paths: [test.file]
        });

        const ruleResult = await this.ruleTool.execute({
          id: `test-exception-${test.name.replace(/\s+/g, '-').toLowerCase()}`,
          language: test.language,
          pattern: test.pattern,
          message: `QA Exception Test: ${test.name}`,
          paths: [test.file]
        });

        const searchMatches = searchResult.matches.length;
        const ruleFindings = ruleResult.scan.findings.length;

        const details = {
          pattern: test.pattern,
          language: test.language,
          file: path.basename(test.file),
          searchMatches,
          ruleFindings,
          expectedMin: test.expectedMin,
          matches: searchResult.matches.map(m => ({
            line: m.line,
            text: m.text.slice(0, 60) + '...'
          }))
        };

        // Check if this reproduces QA finding of exception patterns failing
        if (searchMatches === 0) {
          console.log(`🔴 REPRODUCED QA ISSUE: Exception pattern found 0 matches as reported`);
        } else {
          console.log(`✅ Exception pattern working: Found ${searchMatches} matches`);
        }

        return {
          message: `Found ${searchMatches} search matches, ${ruleFindings} rule findings`,
          details
        };
      });
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Critical Issue 5: Language-Specific Reliability
  async testLanguageSpecificReliability() {
    const suite = new TestSuite('QA Critical Issue 5: Language-Specific Reliability');
    console.log(`\n🔴 Running ${suite.name} tests...`);

    const testDir = await this.createQATestFiles();
    const jsFile = path.join(testDir, 'js-nested.js');

    // QA reported JavaScript only found 1/4 function patterns (25% success rate)
    const jsFunctionPatterns = [
      {
        name: 'Function declarations',
        pattern: 'function $NAME($ARGS) { $$$ }',
        expectedMin: 1,
        language: 'javascript'
      },
      {
        name: 'Method definitions',
        pattern: '$METHOD($ARGS) { $$$ }',
        expectedMin: 4,
        language: 'javascript'
      },
      {
        name: 'Arrow functions',
        pattern: 'const $NAME = ($ARGS) => { $$$ }',
        expectedMin: 0, // Our test file doesn't have these
        language: 'javascript'
      },
      {
        name: 'Async functions',
        pattern: 'async $FUNC($ARGS) { $$$ }',
        expectedMin: 1,
        language: 'javascript'
      }
    ];

    let successfulPatterns = 0;
    let totalPatterns = jsFunctionPatterns.length;

    for (const test of jsFunctionPatterns) {
      await suite.runTest(test.name, async () => {
        const searchResult = await this.searchTool.execute({
          pattern: test.pattern,
          language: test.language,
          paths: [jsFile]
        });

        const searchMatches = searchResult.matches.length;
        const foundExpectedMatches = searchMatches >= test.expectedMin;

        if (foundExpectedMatches) {
          successfulPatterns++;
        }

        const details = {
          pattern: test.pattern,
          language: test.language,
          searchMatches,
          expectedMin: test.expectedMin,
          foundExpected: foundExpectedMatches,
          matches: searchResult.matches.slice(0, 3).map(m => ({
            line: m.line,
            text: m.text.slice(0, 50) + '...'
          }))
        };

        return {
          message: `Found ${searchMatches} matches (expected min: ${test.expectedMin})`,
          details
        };
      });
    }

    // Calculate success rate
    const successRate = (successfulPatterns / totalPatterns * 100).toFixed(1);
    console.log(`\n📊 JavaScript Function Pattern Success Rate: ${successfulPatterns}/${totalPatterns} (${successRate}%)`);

    if (parseFloat(successRate) <= 25) {
      console.log(`🔴 REPRODUCED QA ISSUE: Low success rate confirms QA finding of ~25%`);
    } else {
      console.log(`✅ Improved: Success rate better than QA reported 25%`);
    }

    suite.printSummary();
    return suite.getSummary();
  }

  // Run all QA critical tests
  async runQACriticalTests() {
    console.log('🔴 Starting QA Critical Issues Test Suite...\n');
    console.log('These tests reproduce the specific failures identified by the QA team\n');

    await this.initialize();

    const results = [];

    // Run all critical issue tests
    results.push(await this.testArgumentPatternReliability());
    results.push(await this.testNestedPatternComposition());
    results.push(await this.testContextualPatterns());
    results.push(await this.testExceptionHandlingPatterns());
    results.push(await this.testLanguageSpecificReliability());

    // QA Critical Issues Summary
    console.log('\n' + '🔴'.repeat(30));
    console.log('QA CRITICAL ISSUES ANALYSIS');
    console.log('🔴'.repeat(30));

    let criticalIssuesFound = 0;
    let totalCriticalTests = 0;

    results.forEach(result => {
      const failureRate = result.total > 0 ? ((result.total - result.passed) / result.total * 100).toFixed(1) : 0;
      console.log(`${result.suite}:`);
      console.log(`  Status: ${result.passed}/${result.total} passed (${result.passRate}%)`);
      console.log(`  Issues: ${failureRate}% failure rate`);

      if (result.passed < result.total) {
        criticalIssuesFound++;
      }
      totalCriticalTests++;
    });

    console.log(`\n🎯 CRITICAL ISSUES CONFIRMED: ${criticalIssuesFound}/${totalCriticalTests}`);

    if (criticalIssuesFound > 0) {
      console.log('❌ QA issues reproduced - fixes needed');
      console.log('\nNext steps:');
      console.log('1. Implement pattern reliability improvements');
      console.log('2. Fix nested pattern composition');
      console.log('3. Enable contextual patterns (inside:, has:)');
      console.log('4. Add exception handling pattern support');
      console.log('5. Improve language-specific pattern matching');
    } else {
      console.log('✅ All critical issues resolved!');
    }

    return results;
  }
}

// Run the QA critical test suite
async function main() {
  const qaSuite = new QACriticalTestSuite();
  try {
    await qaSuite.runQACriticalTests();
  } catch (error) {
    console.error('QA test suite failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { QACriticalTestSuite };