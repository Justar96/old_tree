// Test file for ast-grep MCP server testing
console.log('Hello, world!');

function testFunction(arg1, arg2) {
    return arg1 + arg2;
}

const arrow = (x) => x * 2;

class TestClass {
    constructor(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }
}

// Multiple console statements for testing
console.log('Debug message 1');
console.error('Error message');
console.warn('Warning message');
console.log('Debug message 2');

export { testFunction, TestClass };