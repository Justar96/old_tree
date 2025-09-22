/**
 * Test setup file for global configuration
 */

// Global test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AST_GREP_TEST_MODE = 'true';