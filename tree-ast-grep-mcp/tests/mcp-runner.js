#!/usr/bin/env node

/**
 * MCP Inspector Enhanced Test Runner
 * Integrates with Model Context Protocol for enhanced testing and inspection
 */

import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class MCPTestRunner {
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
        this.mcpReport = this.args.includes('--mcp-report');
        this.mcpOutput = this.args.find(arg => arg.startsWith('--mcp-output='))?.split('=')[1] || 'mcp-test-results.json';

        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            suites: [],
            mcpInspections: []
        };
    }

    async findTestFiles() {
        const testDir = __dirname;
        const testFiles = [];

        async function searchRecursively(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                    await searchRecursively(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
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

            // Collect MCP inspection results
            if (suiteResult.inspectionResults) {
                this.results.mcpInspections.push({
                    suite: fileName,
                    inspections: suiteResult.inspectionResults
                });
            }

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
                
                // Show MCP inspection summary
                if (suiteResult.inspectionResults?.results?.length > 0) {
                    const inspections = suiteResult.inspectionResults.results;
                    const passedInspections = inspections.filter(i => i.passed).length;
                    const failedInspections = inspections.filter(i => !i.passed).length;
                    console.log(`  🔍 MCP Inspections - Passed: ${passedInspections}, Failed: ${failedInspections}`);
                }
            }

        } catch (error) {
            console.log(`  💥 Failed to run ${fileName}: ${error.message}`);
            this.results.failed++;
            this.results.total++;
        }
    }

    async generateMCPReport() {
        if (!this.mcpReport) return;

        const mcpReport = {
            version: '1.0',
            type: 'mcp.test-report',
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: this.results.total,
                passedTests: this.results.passed,
                failedTests: this.results.failed,
                successRate: this.results.total > 0 ? (this.results.passed / this.results.total * 100).toFixed(2) : 0
            },
            suites: this.results.suites.map(suite => ({
                name: suite.name,
                passed: suite.passed,
                failed: suite.failed,
                total: suite.total,
                failures: suite.failures || [],
                inspectionResults: suite.inspectionResults || null
            })),
            inspections: this.results.mcpInspections,
            metadata: {
                runner: 'mcp-enhanced-test-runner',
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };

        try {
            await fs.writeFile(this.mcpOutput, JSON.stringify(mcpReport, null, 2));
            console.log(`\n📋 MCP Test Report saved to: ${this.mcpOutput}`);
        } catch (error) {
            console.error(`❌ Failed to save MCP report: ${error.message}`);
        }
    }

    printSummary() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 Test Results Summary');
        console.log('='.repeat(50));

        console.log(`Total Tests: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);

        if (this.results.total > 0) {
            const successRate = (this.results.passed / this.results.total * 100).toFixed(1);
            console.log(`📈 Success Rate: ${successRate}%`);
        }

        // MCP Inspector Summary
        const totalInspections = this.results.mcpInspections.reduce((sum, suite) => 
            sum + (suite.inspections?.results?.length || 0), 0);
        
        if (totalInspections > 0) {
            console.log('\n🔍 MCP Inspector Summary:');
            console.log(`Total Inspections: ${totalInspections}`);
            
            let passedInspections = 0;
            let failedInspections = 0;
            
            this.results.mcpInspections.forEach(suite => {
                if (suite.inspections?.results) {
                    passedInspections += suite.inspections.results.filter(i => i.passed).length;
                    failedInspections += suite.inspections.results.filter(i => !i.passed).length;
                }
            });
            
            console.log(`✅ Passed Inspections: ${passedInspections}`);
            console.log(`❌ Failed Inspections: ${failedInspections}`);
        }

        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.suites.forEach(suite => {
                if (suite.failures && suite.failures.length > 0) {
                    console.log(`\n  ${suite.name}:`);
                    suite.failures.forEach(failure => {
                        console.log(`    - ${failure.test || failure.name}: ${failure.error}`);
                    });
                }
            });
        }

        console.log('='.repeat(50));

        return this.results.failed === 0;
    }

    async run() {
        console.log('🚀 MCP Enhanced Test Runner\n');

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

        await this.generateMCPReport();
        return this.printSummary();
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

    async watchMode() {
        console.log('👁️  Watching for changes (MCP Enhanced)...\n');

        const runTests = async () => {
            console.clear();
            console.log('🔄 Running tests with MCP Inspector...\n');

            this.results = { passed: 0, failed: 0, total: 0, suites: [], mcpInspections: [] };

            const testFiles = await this.findTestFiles();
            for (const file of testFiles) {
                await this.runTestFile(file);
            }

            await this.generateMCPReport();
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
                    console.log(`\n📝 ${filename} changed, running tests with MCP Inspector...`);
                    setTimeout(runTests, 100); // Debounce
                }
            });
        });

        // Keep process alive
        process.stdin.resume();
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const runner = new MCPTestRunner();

    runner.run()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 MCP Test runner failed:', error);
            process.exit(1);
        });
}

export default MCPTestRunner;