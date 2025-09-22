# Test Suite Documentation

This directory contains the comprehensive test suite for the tree-ast-grep-mcp project.

## Architecture

The test suite follows a simple, direct approach aligned with the project's philosophy:

```
tests/
├── runner.js                 # Custom test runner
├── utils/
│   └── test-helpers.js       # Testing utilities and assertions
├── unit/                     # Unit tests for individual components
│   ├── binary-manager.unit.test.js
│   ├── workspace-manager.unit.test.js
│   └── error-handling.unit.test.js
├── integration/              # Integration tests for complete flows
│   ├── search-tool.integration.test.js
│   ├── replace-tool.integration.test.js
│   ├── scan-tool.integration.test.js
│   └── mcp-server.integration.test.js
├── e2e/                      # End-to-end workflow tests
│   └── end-to-end.test.js
├── setup.js                  # Global test setup (for Jest)
└── README.md                 # This file
```

## Running Tests

### Using the Custom Test Runner (Recommended)

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Using Jest (Alternative)

If you prefer Jest, install it and run:

```bash
npm install --save-dev jest @types/jest
npx jest
```

## Test Categories

### Unit Tests
- **binary-manager.unit.test.js**: Tests for ast-grep binary management
- **workspace-manager.unit.test.js**: Tests for workspace detection and path handling
- **error-handling.unit.test.js**: Tests for custom error types

### Integration Tests
- **search-tool.integration.test.js**: Tests for the search tool with real ast-grep execution
- **replace-tool.integration.test.js**: Tests for the replace tool functionality
- **scan-tool.integration.test.js**: Tests for the scan tool with YAML rules
- **mcp-server.integration.test.js**: Tests for the MCP server protocol handling

### End-to-End Tests
- **end-to-end.test.js**: Complete workflow tests simulating real usage scenarios

## Test Utilities

The `test-helpers.js` file provides:

- **TestAssert**: Simple assertion library
- **TestSuite**: Test suite organization
- **MockFileSystem**: File system mocking for tests
- **Timeout helpers**: For handling async operations

## Writing Tests

### Basic Test Structure

```javascript
import { TestSuite, TestAssert } from '../utils/test-helpers.js';

export default async function runMyTests() {
  const suite = new TestSuite('My Test Suite');

  suite.test('should do something', async () => {
    const result = await someOperation();
    TestAssert.assertEqual(result, expectedValue);
  });

  return suite.run();
}
```

### Test Hooks

```javascript
suite.beforeAll(async () => {
  // Setup before all tests
});

suite.afterAll(async () => {
  // Cleanup after all tests
});

suite.beforeEach(async () => {
  // Setup before each test
});

suite.afterEach(async () => {
  // Cleanup after each test
});
```

## Dependencies

Tests assume the following are available:

1. **Built project**: Run `npm run build` before testing
2. **ast-grep binary**: Either system-installed or auto-installed
3. **Node.js 18+**: For ES modules and modern features

## Continuous Integration

The `.github/workflows/test.yml` file defines CI pipeline that:

1. Tests across multiple Node.js versions (18, 20, 22)
2. Tests across multiple operating systems (Ubuntu, Windows, macOS)
3. Installs ast-grep binary automatically
4. Runs all test categories
5. Generates coverage reports
6. Performs security audits

## Test Patterns

### Handling Missing Dependencies

Tests gracefully handle missing dependencies:

```javascript
try {
  const result = await astGrepOperation();
  // Test the result
} catch (error) {
  if (error.message.includes('ast-grep not found')) {
    console.log('  ⚠️  Skipping test - ast-grep not available');
    return;
  }
  throw error;
}
```

### Timeout Handling

All async operations use timeouts:

```javascript
const result = await withTimeout(
  operation(),
  5000,
  'Operation timed out'
);
```

### File System Testing

Use temporary directories for file operations:

```javascript
suite.beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(tmpdir(), 'test-'));
});

suite.afterAll(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});
```

## Coverage Goals

- **Unit tests**: 100% coverage of core components
- **Integration tests**: All tool combinations
- **E2E tests**: Real-world usage scenarios
- **Error cases**: All error conditions handled

## Performance Considerations

- Tests run in parallel where possible
- Timeouts prevent hanging tests
- Cleanup prevents resource leaks
- Minimal external dependencies

## Debugging Tests

### Verbose Output

```bash
npm test -- --verbose
```

### Single Test File

```bash
node tests/unit/binary-manager.unit.test.js
```

### Debug with Node Inspector

```bash
node --inspect-brk tests/runner.js
```

## Contributing

When adding tests:

1. Follow the existing patterns
2. Include both success and error cases
3. Use descriptive test names
4. Handle missing dependencies gracefully
5. Add cleanup for any resources used
6. Update this README if adding new test categories