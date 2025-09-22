#!/usr/bin/env node

/**
 * Simple Test Runner for debugging
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runSimpleTest() {
  console.log('🚀 Simple Test Runner Starting...');
  console.log('Current directory:', __dirname);

  try {
    // Try to import a unit test
    const testPath = path.join(__dirname, 'unit', 'error-handling.unit.test.js');
    const testUrl = `file://${testPath.replace(/\\/g, '/')}`;
    console.log('Attempting to import:', testUrl);

    const { default: testSuite } = await import(testUrl);

    if (typeof testSuite === 'function') {
      console.log('✅ Test suite imported successfully');
      const result = await testSuite();
      console.log('✅ Test result:', result);
    } else {
      console.log('❌ Test suite is not a function');
    }

  } catch (error) {
    console.error('❌ Error running test:', error.message);
    console.error('Stack:', error.stack);
  }
}

runSimpleTest();