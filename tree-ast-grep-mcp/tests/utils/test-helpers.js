/**
 * Test Helper Utilities
 * Simple, direct testing utilities following project philosophy
 */

import { MCPTestAssert } from './mcp-inspector.js';

export { MCPTestAssert as TestAssert };

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
  }

  beforeAll(fn) {
    this.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    this.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    this.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    this.afterEachHooks.push(fn);
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n📦 Running suite: ${this.name}`);

    const results = {
      name: this.name,
      passed: 0,
      failed: 0,
      total: this.tests.length,
      failures: [],
      inspectionResults: null
    };

    // Run beforeAll hooks
    for (const hook of this.beforeAllHooks) {
      await hook();
    }

    try {
      // Clear previous inspection results
      MCPTestAssert.clearInspectionResults();

      for (const test of this.tests) {
        const testName = `${this.name} > ${test.name}`;

        try {
          // Run beforeEach hooks
          for (const hook of this.beforeEachHooks) {
            await hook();
          }

          // Run the test
          await test.fn();

          // Run afterEach hooks
          for (const hook of this.afterEachHooks) {
            await hook();
          }

          console.log(`  ✅ ${test.name}`);
          results.passed++;

        } catch (error) {
          console.log(`  ❌ ${test.name}: ${error.message}`);
          results.failed++;
          results.failures.push({
            test: testName,
            error: error.message,
            stack: error.stack
          });

          // Still run afterEach hooks on failure
          try {
            for (const hook of this.afterEachHooks) {
              await hook();
            }
          } catch (hookError) {
            console.log(`  ⚠️  afterEach hook failed: ${hookError.message}`);
          }
        }
      }

      // Add inspection results to suite results
      results.inspectionResults = MCPTestAssert.getInspectionResults();

    } finally {
      // Run afterAll hooks
      for (const hook of this.afterAllHooks) {
        try {
          await hook();
        } catch (hookError) {
          console.log(`  ⚠️  afterAll hook failed: ${hookError.message}`);
        }
      }
    }

    return results;
  }
}

export class MockFileSystem {
  constructor() {
    this.files = new Map();
    this.directories = new Set();
  }

  addFile(path, content) {
    this.files.set(path, content);

    // Add parent directories
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const dir = parts.slice(0, i).join('/');
      if (dir) this.directories.add(dir);
    }
  }

  addDirectory(path) {
    this.directories.add(path);
  }

  exists(path) {
    return this.files.has(path) || this.directories.has(path);
  }

  readFile(path) {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory '${path}'`);
    }
    return this.files.get(path);
  }

  writeFile(path, content) {
    this.files.set(path, content);
  }

  listDirectory(path) {
    const results = [];
    const prefix = path.endsWith('/') ? path : path + '/';

    // Add direct child files
    for (const [filePath] of this.files) {
      if (filePath.startsWith(prefix)) {
        const relativePath = filePath.substring(prefix.length);
        if (!relativePath.includes('/')) {
          results.push(relativePath);
        }
      }
    }

    // Add direct child directories
    for (const dirPath of this.directories) {
      if (dirPath.startsWith(prefix)) {
        const relativePath = dirPath.substring(prefix.length);
        if (!relativePath.includes('/')) {
          results.push(relativePath + '/');
        }
      }
    }

    return results;
  }

  clear() {
    this.files.clear();
    this.directories.clear();
  }
}

export function createTempTestFiles() {
  const mockFs = new MockFileSystem();

  // Add some test files
  mockFs.addFile('src/example.js', `
function greet(name) {
  console.log("Hello, " + name);
}

class User {
  constructor(name) {
    this.name = name;
  }
}
`);

  mockFs.addFile('src/utils.ts', `
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export const CONFIG = {
  debug: true,
  version: "1.0.0"
};
`);

  mockFs.addFile('test/example.test.js', `
import { greet } from '../src/example.js';

describe('greet function', () => {
  test('should greet user', () => {
    greet('World');
  });
});
`);

  return mockFs;
}

export function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withTimeout(promise, ms, message = 'Operation timed out') {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]);
}