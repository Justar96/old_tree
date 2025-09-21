// Test file for demonstrating ast-grep functionality
function logMessage(message) {
    console.log("Debug: " + message);
}

function processData(data) {
    console.log("Processing:", data);
    return data.map(item => item.value);
}

class DataProcessor {
    constructor() {
        this.items = [];
    }
    
    addItem(item) {
        console.log("Adding item:", item);
        this.items.push(item);
    }
    
    getCount() {
        return this.items.length;
    }
}

// Legacy code patterns
var oldStyleVar = "test";
function oldFunction() {
    console.log("Old style function");
}

module.exports = { DataProcessor, logMessage, processData };