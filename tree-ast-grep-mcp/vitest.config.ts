import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/vitest-adapter.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    reporters: ['default'],
    coverage: {
      enabled: false
    }
  }
});