import { test, expect } from 'vitest';
import { readdir } from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';

async function findTestFiles() {
  const roots = ['tests/unit'];
  if (process.env.AST_GREP_AVAILABLE === '1') {
    roots.push(
      'tests/integration',
      'tests/e2e',
      'tests/security',
      'tests/stress',
      'tests/real-world',
    );
  }
  const files: string[] = [];

  for (const rel of roots) {
    const dir = path.resolve(process.cwd(), rel);
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && (e.name.endsWith('.test.js') || e.name.endsWith('.unit.test.js') || e.name.endsWith('.integration.test.js'))) {
          files.push(path.join(dir, e.name));
        }
      }
    } catch {
      // skip missing directories
    }
  }
  return files;
}

test('run custom test suites via adapter', async () => {
  const files = await findTestFiles();
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    const runner = mod.default || mod.run || mod.runTests;
    expect(typeof runner === 'function').toBe(true);
    const result = await runner();
    // result should have { passed, failed, total }
    expect(result && typeof result === 'object').toBe(true);
    expect('passed' in result).toBe(true);
    expect('failed' in result).toBe(true);
    expect('total' in result).toBe(true);
  }
}, 60000);
