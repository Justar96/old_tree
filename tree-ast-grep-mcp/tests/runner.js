#!/usr/bin/env node

/**
 * Test Runner for tree-ast-grep-mcp
 * Simple, direct test execution following project philosophy
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TestRunner {
  constructor() {
    this.args = process.argv.slice(2);
    this.unitOnly = this.args.includes('--unit');
    this.integrationOnly = this.args.includes('--integration');
    this.e2eOnly = this.args.includes('--e2e');
    this.stressOnly = this.args.includes('--stress');
    this.securityOnly = this.args.includes('--security');
    this.realWorldOnly = this.args.includes('--real-world');
    this.complexOnly = this.args.includes('--complex');
    this.allTests = this.args.includes('--all');
    this.watch = this.args.includes('--watch');
    this.coverage = this.args.includes('--coverage');
    this.verbose = this.args.includes('--verbose') || this.args.includes('-v');

    this.results = {
      passed: 0,
      failed: 0,
      total: 0,
      suites: []
    };
  }

  async findTestFiles() {
    const testDir = __dirname;
    const testFiles = [];

    async function searchRecursively(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await searchRecursively(fullPath);
        } else if (entry.name.endsWith('.test.js')) {
          testFiles.push(fullPath);
        }
      }
    }

    await searchRecursively(testDir);

    return testFiles.filter(file => {
      if (this.unitOnly) return file.includes('unit');
      if (this.integrationOnly) return file.includes('integration');
      if (this.e2eOnly) return file.includes('e2e');
      if (this.stressOnly) return file.includes('stress');
      if (this.securityOnly) return file.includes('security');
      if (this.realWorldOnly) return file.includes('real-world');
      if (this.complexOnly) return file.includes('complex');
      if (this.allTests) return true;

      // Default: run unit and integration tests only (not stress/security/etc)
      return file.includes('unit') || file.includes('integration');
    });
  }

  async runTestFile(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\n🧪 Running ${fileName}...`);

    try {
      // Convert Windows path to URL for ESM import
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const { default: testSuite } = await import(fileUrl);

      if (typeof testSuite !== 'function') {
        throw new Error(`Test file ${fileName} must export a default function`);
      }

      const suiteResult = await testSuite();

      this.results.suites.push({
        name: fileName,
        ...suiteResult
      });

      this.results.passed += suiteResult.passed;
      this.results.failed += suiteResult.failed;
      this.results.total += suiteResult.total;

      if (this.verbose) {
        console.log(`  ✅ Passed: ${suiteResult.passed}`);
        console.log(`  ❌ Failed: ${suiteResult.failed}`);
      }

    } catch (error) {
      console.error(`❌ Error running ${fileName}:`, error.message);
      this.results.failed += 1;
      this.results.total += 1;
    }
  }

  async runWithCoverage(testFiles) {
    console.log('📊 Running tests with coverage...\n');

    return new Promise((resolve, reject) => {
      const c8Process = spawn('npx', [
        'c8',
        '--reporter', 'text',
        '--reporter', 'html',
        '--exclude', 'tests/**',
        '--exclude', 'build/**',
        '--exclude', 'node_modules/**',
        'node',
        ...testFiles
      ], {
        stdio: 'inherit',
        shell: process.platform === 'win32'
      });

      c8Process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Coverage process exited with code ${code}`));
        }
      });

      c8Process.on('error', reject);
    });
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(50));

    const passRate = this.results.total > 0 ?
      ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;

    console.log(`Total Tests: ${this.results.total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📊 Pass Rate: ${passRate}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Test Suites:');
      this.results.suites
        .filter(suite => suite.failed > 0)
        .forEach(suite => {
          console.log(`  - ${suite.name}: ${suite.failed} failures`);
        });
    }

    console.log('='.repeat(50));

    return this.results.failed === 0;
  }

  async watchMode() {
    console.log('👁️  Watching for changes...\n');

    const runTests = async () => {
      console.clear();
      console.log('🔄 Running tests...\n');

      this.results = { passed: 0, failed: 0, total: 0, suites: [] };

      const testFiles = await this.findTestFiles();
      for (const file of testFiles) {
        await this.runTestFile(file);
      }

      this.printSummary();
      console.log('\n👁️  Watching for changes...');
    };

    // Initial run
    await runTests();

    // Watch for changes
    const watchDirs = [
      path.join(__dirname, '../src'),
      path.join(__dirname)
    ];

    const { watch } = await import('fs');

    watchDirs.forEach(dir => {
      watch(dir, { recursive: true }, async (eventType, filename) => {
        if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
          console.log(`\n📝 ${filename} changed, running tests...`);
          setTimeout(runTests, 100); // Debounce
        }
      });
    });

    // Keep process alive
    process.stdin.resume();
  }

  async run() {
    console.log('🚀 tree-ast-grep-mcp Test Runner\n');

    if (this.watch) {
      return this.watchMode();
    }

    const testFiles = await this.findTestFiles();

    if (testFiles.length === 0) {
      console.log('⚠️  No test files found');
      return true;
    }

    console.log(`Found ${testFiles.length} test file(s):`);
    testFiles.forEach(file => console.log(`  - ${path.basename(file)}`));

    if (this.coverage) {
      await this.runWithCoverage(testFiles);
      return true;
    }

    for (const file of testFiles) {
      await this.runTestFile(file);
    }

    return this.printSummary();
  }
}

// Run if called directly
const runner = new TestRunner();

runner.run()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });

export default TestRunner;