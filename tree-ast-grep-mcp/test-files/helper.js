// Additional JavaScript file to test multiple file scenarios
function debugLog(message) {
  console.log("[DEBUG]", message);
}

function errorLog(error) {
  console.log("[ERROR]", error.message);
}

module.exports = { debugLog, errorLog };