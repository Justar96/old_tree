/**
 * Unit tests for Error Handling
 */

import { BinaryError, ValidationError, ExecutionError } from '../../build/types/errors.js';
import { TestSuite, TestAssert } from '../utils/test-helpers.js';

export default async function runErrorHandlingTests() {
  const suite = new TestSuite('Error Handling Unit Tests');

  suite.test('should create BinaryError correctly', async () => {
    const error = new BinaryError('Binary not found');

    TestAssert.assertInstanceOf(error, BinaryError);
    TestAssert.assertInstanceOf(error, Error);
    TestAssert.assertEqual(error.name, 'BinaryError');
    TestAssert.assertEqual(error.message, 'Binary not found');
    TestAssert.assertTrue(error.stack.includes('BinaryError'));
  });

  suite.test('should create ValidationError correctly', async () => {
    const context = { field: 'pattern', value: null };
    const error = new ValidationError('Pattern is required', context);

    TestAssert.assertInstanceOf(error, ValidationError);
    TestAssert.assertInstanceOf(error, Error);
    TestAssert.assertEqual(error.name, 'ValidationError');
    TestAssert.assertEqual(error.message, 'Pattern is required');
    TestAssert.assertEqual(error.code, 'VALIDATION_ERROR');
    TestAssert.assertEqual(error.recoverable, true);
    TestAssert.assertDeepEqual(error.context, context);
  });

  suite.test('should create ExecutionError correctly', async () => {
    const context = { exitCode: 1, stderr: 'stderr output' };
    const error = new ExecutionError('Command failed', context);

    TestAssert.assertInstanceOf(error, ExecutionError);
    TestAssert.assertInstanceOf(error, Error);
    TestAssert.assertEqual(error.name, 'ExecutionError');
    TestAssert.assertEqual(error.message, 'Command failed');
    TestAssert.assertEqual(error.code, 'EXECUTION_ERROR');
    TestAssert.assertEqual(error.recoverable, true);
    TestAssert.assertDeepEqual(error.context, context);
  });

  suite.test('should handle error serialization', async () => {
    const validationError = new ValidationError('Invalid input', { field: 'test' });

    const serialized = JSON.stringify({
      name: validationError.name,
      message: validationError.message,
      code: validationError.code,
      context: validationError.context
    });

    const parsed = JSON.parse(serialized);

    TestAssert.assertEqual(parsed.name, 'ValidationError');
    TestAssert.assertEqual(parsed.message, 'Invalid input');
    TestAssert.assertEqual(parsed.code, 'VALIDATION_ERROR');
    TestAssert.assertDeepEqual(parsed.context, { field: 'test' });
  });

  suite.test('should handle ExecutionError with various exit codes', async () => {
    const error1 = new ExecutionError('Failed', { exitCode: 1 });
    const error2 = new ExecutionError('Failed', { exitCode: 127 });
    const error3 = new ExecutionError('Failed', { exitCode: 0 });

    TestAssert.assertEqual(error1.context.exitCode, 1);
    TestAssert.assertEqual(error2.context.exitCode, 127);
    TestAssert.assertEqual(error3.context.exitCode, 0);
  });

  suite.test('should handle error inheritance correctly', async () => {
    const binaryError = new BinaryError('test');
    const validationError = new ValidationError('test');
    const executionError = new ExecutionError('test');

    TestAssert.assertTrue(binaryError instanceof Error);
    TestAssert.assertTrue(validationError instanceof Error);
    TestAssert.assertTrue(executionError instanceof Error);

    TestAssert.assertEqual(binaryError.constructor.name, 'BinaryError');
    TestAssert.assertEqual(validationError.constructor.name, 'ValidationError');
    TestAssert.assertEqual(executionError.constructor.name, 'ExecutionError');
  });

  suite.test('should handle error stack traces', async () => {
    const error = new ValidationError('Stack test');

    TestAssert.assertTrue(typeof error.stack === 'string');
    TestAssert.assertTrue(error.stack.length > 0);
    TestAssert.assertTrue(error.stack.includes('ValidationError'));
    TestAssert.assertTrue(error.stack.includes('Stack test'));
  });

  suite.test('should handle empty error messages', async () => {
    const error1 = new BinaryError('');
    const error2 = new ValidationError();
    const error3 = new ExecutionError();

    TestAssert.assertEqual(error1.message, '');
    TestAssert.assertTrue(typeof error2.message === 'string');
    TestAssert.assertTrue(typeof error3.message === 'string');
  });

  return suite.run();
}