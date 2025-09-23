/**
 * MCP Inspector Integration
 * Provides test inspection capabilities following Model Context Protocol
 */

export class MCPInspector {
    constructor() {
        this.inspectionResults = [];
    }

    /**
     * Record a test inspection result
     */
    recordInspection(data) {
        this.inspectionResults.push({
            timestamp: new Date().toISOString(),
            ...data
        });
    }

    /**
     * Inspect an AST pattern result
     */
    inspectPattern(pattern, result, expected = null) {
        const inspection = {
            type: 'pattern',
            pattern,
            result,
            expected,
            passed: expected === null || JSON.stringify(result) === JSON.stringify(expected)
        };
        
        this.recordInspection(inspection);
        return inspection.passed;
    }

    /**
     * Inspect a code transformation result
     */
    inspectTransformation(input, output, expected = null) {
        const inspection = {
            type: 'transformation',
            input,
            output,
            expected,
            passed: expected === null || output === expected
        };

        this.recordInspection(inspection);
        return inspection.passed;
    }

    /**
     * Get all inspection results in MCP format
     */
    getResults() {
        return {
            type: 'mcp.inspection',
            version: '1.0',
            results: this.inspectionResults
        };
    }

    /**
     * Clear all inspection results
     */
    clear() {
        this.inspectionResults = [];
    }
}

/**
 * Base TestAssert class with standard assertion methods
 */
export class TestAssert {
    static assertTrue(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(`AssertionError: ${message}`);
        }
    }

    static assertFalse(condition, message = 'Expected false') {
        if (condition) {
            throw new Error(`AssertionError: ${message}`);
        }
    }

    static assertEqual(actual, expected, message = 'Values not equal') {
        if (actual !== expected) {
            throw new Error(`AssertionError: ${message}\nExpected: ${expected}\nActual: ${actual}`);
        }
    }

    static assertNotEqual(actual, expected, message = 'Values should not be equal') {
        if (actual === expected) {
            throw new Error(`AssertionError: ${message}\nBoth values: ${actual}`);
        }
    }

    static assertDeepEqual(actual, expected, message = 'Objects not deeply equal') {
        const actualStr = JSON.stringify(actual, null, 2);
        const expectedStr = JSON.stringify(expected, null, 2);

        if (actualStr !== expectedStr) {
            throw new Error(`AssertionError: ${message}\nExpected: ${expectedStr}\nActual: ${actualStr}`);
        }
    }

    static assertThrows(fn, expectedError, message = 'Expected function to throw') {
        try {
            fn();
            throw new Error(`AssertionError: ${message}`);
        } catch (error) {
            if (expectedError && !error.message.includes(expectedError)) {
                throw new Error(`AssertionError: Expected error containing "${expectedError}", got "${error.message}"`);
            }
        }
    }

    static async assertThrowsAsync(fn, expectedError, message = 'Expected async function to throw') {
        try {
            await fn();
            throw new Error(`AssertionError: ${message}`);
        } catch (error) {
            if (expectedError && !error.message.includes(expectedError)) {
                throw new Error(`AssertionError: Expected error containing "${expectedError}", got "${error.message}"`);
            }
        }
    }

    static assertContains(haystack, needle, message = 'String not found') {
        if (!haystack.includes(needle)) {
            throw new Error(`AssertionError: ${message}\nExpected "${haystack}" to contain "${needle}"`);
        }
    }

    static assertNotContains(haystack, needle, message = 'String should not be found') {
        if (haystack.includes(needle)) {
            throw new Error(`AssertionError: ${message}\nExpected "${haystack}" to not contain "${needle}"`);
        }
    }

    static assertInstanceOf(obj, constructor, message = 'Object not instance of expected type') {
        if (!(obj instanceof constructor)) {
            throw new Error(`AssertionError: ${message}\nExpected instance of ${constructor.name}`);
        }
    }

    static assertArrayLength(array, expectedLength, message = 'Array length mismatch') {
        if (!Array.isArray(array)) {
            throw new Error(`AssertionError: Expected array, got ${typeof array}`);
        }
        if (array.length !== expectedLength) {
            throw new Error(`AssertionError: ${message}\nExpected length: ${expectedLength}\nActual length: ${array.length}`);
        }
    }
}

/**
 * Enhanced assertions with MCP inspection
 */
export class MCPTestAssert extends TestAssert {
    static inspector = new MCPInspector();

    static assertPattern(pattern, result, expected = null) {
        const passed = this.inspector.inspectPattern(pattern, result, expected);
        this.assertTrue(passed, `Pattern assertion failed for: ${pattern}`);
    }

    static assertTransformation(input, output, expected = null) {
        const passed = this.inspector.inspectTransformation(input, output, expected);
        this.assertTrue(passed, `Transformation assertion failed`);
    }

    static getInspectionResults() {
        return this.inspector.getResults();
    }

    static clearInspectionResults() {
        this.inspector.clear();
    }
}