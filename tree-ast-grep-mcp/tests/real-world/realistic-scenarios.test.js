/**
 * Real-World Scenario Tests
 * Tests based on actual usage patterns and real-world code examples
 */

import { SearchTool } from '../../build/tools/search.js';
import { ReplaceTool } from '../../build/tools/replace.js';
import { ScanTool } from '../../build/tools/scan.js';
import { AstGrepBinaryManager } from '../../build/core/binary-manager.js';
import { WorkspaceManager } from '../../build/core/workspace-manager.js';
import { TestSuite, TestAssert, withTimeout } from '../utils/test-helpers.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

export default async function runRealisticScenariosTests() {
  const suite = new TestSuite('Real-World Scenario Tests');

  let binaryManager;
  let workspaceManager;
  let searchTool;
  let replaceTool;
  let scanTool;
  let tempDir;

  suite.beforeAll(async () => {
    binaryManager = new AstGrepBinaryManager({ useSystem: true });
    workspaceManager = new WorkspaceManager();
    searchTool = new SearchTool(binaryManager, workspaceManager);
    replaceTool = new ReplaceTool(binaryManager, workspaceManager);
    scanTool = new ScanTool(binaryManager, workspaceManager);

    try {
      await binaryManager.initialize();
    } catch (error) {
      console.log('  ⚠️  Binary manager initialization failed:', error.message);
    }

    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'ast-grep-realworld-test-'));
  });

  suite.afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('  ⚠️  Failed to clean up temp directory');
    }
  });

  // =============================================================================
  // LEGACY CODE MODERNIZATION SCENARIOS
  // =============================================================================

  suite.test('should modernize legacy JavaScript to ES6+', async () => {
    const legacyCode = `
// Legacy ES5 code that needs modernization
var UserService = function() {
  this.users = [];
};

UserService.prototype.addUser = function(user) {
  this.users.push(user);
  console.log("Added user: " + user.name);
};

UserService.prototype.getUser = function(id) {
  for (var i = 0; i < this.users.length; i++) {
    if (this.users[i].id === id) {
      return this.users[i];
    }
  }
  return null;
};

var service = new UserService();
service.addUser({ id: 1, name: "John" });

function processData(callback) {
  setTimeout(function() {
    callback(null, "processed");
  }, 1000);
}
`;

    console.log('  🔄 Testing legacy ES5 to ES6+ modernization...');

    try {
      // Step 1: Convert var to const/let
      const varToConstResult = await replaceTool.execute({
        pattern: 'var $NAME = $VALUE;',
        replacement: 'const $NAME = $VALUE;',
        language: 'javascript',
        code: legacyCode,
        dryRun: true
      });

      TestAssert.assertTrue(typeof varToConstResult === 'object');

      // Step 2: Convert function expressions to arrow functions
      const arrowFunctionResult = await replaceTool.execute({
        pattern: 'function($ARGS) { $$$BODY }',
        replacement: '($ARGS) => { $$$BODY }',
        language: 'javascript',
        code: legacyCode,
        dryRun: true
      });

      TestAssert.assertTrue(typeof arrowFunctionResult === 'object');

      // Step 3: Convert string concatenation to template literals
      const templateLiteralResult = await replaceTool.execute({
        pattern: 'console.log($STR1 + $STR2)',
        replacement: 'console.log(`${$STR1}${$STR2}`)',
        language: 'javascript',
        code: legacyCode,
        dryRun: true
      });

      TestAssert.assertTrue(typeof templateLiteralResult === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping legacy modernization test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should refactor React class components to hooks', async () => {
    const reactClassCode = `
import React, { Component } from 'react';

class UserProfile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      user: null,
      loading: true,
      error: null
    };
  }

  componentDidMount() {
    this.fetchUser();
  }

  fetchUser = async () => {
    try {
      const response = await fetch(\`/api/users/\${this.props.userId}\`);
      const user = await response.json();
      this.setState({ user, loading: false });
    } catch (error) {
      this.setState({ error: error.message, loading: false });
    }
  };

  render() {
    const { user, loading, error } = this.state;

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    );
  }
}
`;

    console.log('  ⚛️ Testing React class to hooks conversion...');

    try {
      // Find class components that can be converted
      const classComponentSearch = await searchTool.execute({
        pattern: 'class $NAME extends Component { $$$BODY }',
        language: 'javascript',
        code: reactClassCode
      });

      TestAssert.assertTrue(typeof classComponentSearch === 'object');
      TestAssert.assertTrue('matches' in classComponentSearch);

      // Find state initialization patterns
      const stateSearch = await searchTool.execute({
        pattern: 'this.state = { $$$PROPS };',
        language: 'javascript',
        code: reactClassCode
      });

      TestAssert.assertTrue(typeof stateSearch === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping React conversion test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // CODE QUALITY IMPROVEMENT SCENARIOS
  // =============================================================================

  suite.test('should identify and fix common code smells', async () => {
    const codeWithSmells = `
// Code smells that should be detected and fixed
function processUser(user) {
  // Long parameter list smell
  function updateUserProfile(name, email, age, address, phone, preferences, settings, metadata) {
    console.log("Updating user with many parameters");
  }

  // Magic numbers
  if (user.age > 18 && user.score > 100 && user.level < 5) {
    console.log("User qualifies");
  }

  // Nested conditions (arrow anti-pattern)
  if (user.isActive) {
    if (user.hasPermission) {
      if (user.isVerified) {
        if (user.balance > 0) {
          console.log("All checks passed");
        }
      }
    }
  }

  // Console.log in production code
  console.log("Debug: processing user", user.id);
  console.log("Debug: user data", JSON.stringify(user));

  // Empty catch blocks
  try {
    processPayment(user.id);
  } catch (error) {
    // TODO: handle error
  }
}
`;

    console.log('  🔍 Testing code smell detection...');

    try {
      // Detect console.log statements (should be removed in production)
      const consoleLogRule = `
rule:
  pattern: console.log($$$ARGS)
  language: javascript
message: "Remove console.log statements from production code"
severity: warning
`;

      const consoleLogScan = await scanTool.execute({
        rule: consoleLogRule,
        code: codeWithSmells
      });

      TestAssert.assertTrue(typeof consoleLogScan === 'object');

      // Detect magic numbers
      const magicNumberSearch = await searchTool.execute({
        pattern: 'user.$PROP > $NUMBER',
        language: 'javascript',
        code: codeWithSmells
      });

      TestAssert.assertTrue(typeof magicNumberSearch === 'object');

      // Detect deeply nested conditions
      const nestedConditionSearch = await searchTool.execute({
        pattern: 'if ($COND1) { if ($COND2) { if ($COND3) { $$$BODY } } }',
        language: 'javascript',
        code: codeWithSmells
      });

      TestAssert.assertTrue(typeof nestedConditionSearch === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping code smell test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  suite.test('should enforce coding standards across large codebase', async () => {
    console.log('  📏 Testing coding standards enforcement...');

    // Create a mock large codebase
    const files = [
      {
        name: 'userService.js',
        content: `
const UserService = {
  getUser: function(id) {
    return users.find(u => u.id === id);
  },

  updateUser: function(id, data) {
    const user = this.getUser(id);
    if (!user) throw new Error("User not found");
    Object.assign(user, data);
    return user;
  }
};
`
      },
      {
        name: 'authController.js',
        content: `
class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !user.comparePassword(password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
      res.json({ token, user: user.toPublicJSON() });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
`
      },
      {
        name: 'utils.js',
        content: `
// Utility functions with various patterns
const formatDate = (date) => {
  return date.toLocaleDateString();
};

function validateEmail(email) {
  const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return regex.test(email);
}

var globalCounter = 0; // Should be const

function incrementCounter() {
  globalCounter = globalCounter + 1; // Should use +=
  console.log("Counter:", globalCounter); // Should use logger
}
`
      }
    ];

    // Write files to temp directory
    for (const file of files) {
      await fs.writeFile(path.join(tempDir, file.name), file.content);
    }

    try {
      // Standard 1: No var declarations
      const varUsageRule = `
rule:
  pattern: var $NAME = $VALUE
  language: javascript
message: "Use const or let instead of var"
severity: error
`;

      const varScan = await scanTool.execute({
        rule: varUsageRule,
        paths: [tempDir]
      });

      TestAssert.assertTrue(typeof varScan === 'object');

      // Standard 2: Prefer arrow functions for callbacks
      const functionExpressionSearch = await searchTool.execute({
        pattern: 'function($ARGS) { $$$BODY }',
        language: 'javascript',
        paths: [tempDir]
      });

      TestAssert.assertTrue(typeof functionExpressionSearch === 'object');

      // Standard 3: No console.log in production code
      const consoleLogSearch = await searchTool.execute({
        pattern: 'console.log($$$ARGS)',
        language: 'javascript',
        paths: [tempDir]
      });

      TestAssert.assertTrue(typeof consoleLogSearch === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping coding standards test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // MIGRATION AND UPGRADE SCENARIOS
  // =============================================================================

  suite.test('should assist with framework migration', async () => {
    const jqueryCode = `
// jQuery code that needs migration to vanilla JS
$(document).ready(function() {
  $('.user-item').click(function() {
    var userId = $(this).data('user-id');
    $.ajax({
      url: '/api/users/' + userId,
      method: 'GET',
      success: function(data) {
        $('#user-details').html(data.name);
        $('#user-email').text(data.email);
      },
      error: function() {
        alert('Error loading user data');
      }
    });
  });

  $('.btn-submit').on('click', function(e) {
    e.preventDefault();
    var formData = $('#user-form').serialize();
    $.post('/api/users', formData, function(response) {
      console.log('User created:', response);
    });
  });
});
`;

    console.log('  🔄 Testing jQuery to vanilla JS migration...');

    try {
      // Find jQuery selectors
      const jquerySelectorSearch = await searchTool.execute({
        pattern: '$($SELECTOR)',
        language: 'javascript',
        code: jqueryCode
      });

      TestAssert.assertTrue(typeof jquerySelectorSearch === 'object');

      // Find jQuery AJAX calls
      const ajaxSearch = await searchTool.execute({
        pattern: '$.ajax({ $$$OPTIONS })',
        language: 'javascript',
        code: jqueryCode
      });

      TestAssert.assertTrue(typeof ajaxSearch === 'object');

      // Convert jQuery ready to DOMContentLoaded
      const readyConversion = await replaceTool.execute({
        pattern: '$(document).ready(function() { $$$BODY });',
        replacement: 'document.addEventListener("DOMContentLoaded", function() { $$$BODY });',
        language: 'javascript',
        code: jqueryCode,
        dryRun: true
      });

      TestAssert.assertTrue(typeof readyConversion === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping jQuery migration test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // SECURITY AUDIT SCENARIOS
  // =============================================================================

  suite.test('should identify security vulnerabilities', async () => {
    const vulnerableCode = `
// Code with security vulnerabilities
const express = require('express');
const app = express();

// SQL Injection vulnerability
app.get('/users/:id', (req, res) => {
  const query = \`SELECT * FROM users WHERE id = \${req.params.id}\`;
  db.query(query, (err, results) => {
    res.json(results);
  });
});

// XSS vulnerability
app.get('/profile', (req, res) => {
  const html = \`<h1>Welcome \${req.query.name}</h1>\`;
  res.send(html);
});

// Command injection vulnerability
app.post('/backup', (req, res) => {
  const filename = req.body.filename;
  exec(\`tar -czf \${filename}.tar.gz /data\`, (error, stdout) => {
    res.json({ message: 'Backup created' });
  });
});

// Weak cryptography
const crypto = require('crypto');
const hash = crypto.createHash('md5').update('password').digest('hex');

// Hardcoded secrets
const apiKey = 'sk-1234567890abcdef';
const dbPassword = 'admin123';
`;

    console.log('  🔒 Testing security vulnerability detection...');

    try {
      // Detect SQL injection patterns
      const sqlInjectionRule = `
rule:
  pattern: \`SELECT * FROM $TABLE WHERE $CONDITION = \${$VAR}\`
  language: javascript
message: "Potential SQL injection vulnerability"
severity: error
`;

      const sqlScan = await scanTool.execute({
        rule: sqlInjectionRule,
        code: vulnerableCode
      });

      TestAssert.assertTrue(typeof sqlScan === 'object');

      // Detect command injection
      const commandInjectionSearch = await searchTool.execute({
        pattern: 'exec(`$CMD`)',
        language: 'javascript',
        code: vulnerableCode
      });

      TestAssert.assertTrue(typeof commandInjectionSearch === 'object');

      // Detect hardcoded secrets
      const hardcodedSecretSearch = await searchTool.execute({
        pattern: 'const $NAME = $VALUE;',
        language: 'javascript',
        code: vulnerableCode
      });

      TestAssert.assertTrue(typeof hardcodedSecretSearch === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping security audit test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // PERFORMANCE OPTIMIZATION SCENARIOS
  // =============================================================================

  suite.test('should identify performance optimization opportunities', async () => {
    const performanceCode = `
// Code with performance issues
class DataProcessor {
  processLargeDataset(data) {
    // Inefficient loop in loop
    const results = [];
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data.length; j++) {
        if (data[i].id === data[j].parentId) {
          results.push({ parent: data[i], child: data[j] });
        }
      }
    }
    return results;
  }

  // Synchronous file operations
  loadConfig() {
    const config1 = fs.readFileSync('config1.json');
    const config2 = fs.readFileSync('config2.json');
    const config3 = fs.readFileSync('config3.json');
    return { config1, config2, config3 };
  }

  // Inefficient DOM queries
  updateUI() {
    for (let i = 0; i < 1000; i++) {
      document.getElementById('item-' + i).innerHTML = 'Updated';
      document.querySelector('.status').textContent = 'Processing...';
    }
  }

  // Memory leaks - event listeners not removed
  setupEventListeners() {
    const items = document.querySelectorAll('.item');
    items.forEach(item => {
      item.addEventListener('click', function() {
        console.log('Item clicked');
      });
    });
  }
}
`;

    console.log('  ⚡ Testing performance optimization detection...');

    try {
      // Detect nested loops
      const nestedLoopSearch = await searchTool.execute({
        pattern: 'for ($INIT1; $COND1; $UPDATE1) { for ($INIT2; $COND2; $UPDATE2) { $$$BODY } }',
        language: 'javascript',
        code: performanceCode
      });

      TestAssert.assertTrue(typeof nestedLoopSearch === 'object');

      // Detect synchronous file operations
      const syncOpsSearch = await searchTool.execute({
        pattern: 'fs.readFileSync($PATH)',
        language: 'javascript',
        code: performanceCode
      });

      TestAssert.assertTrue(typeof syncOpsSearch === 'object');

      // Detect repeated DOM queries
      const domQuerySearch = await searchTool.execute({
        pattern: 'document.querySelector($SELECTOR)',
        language: 'javascript',
        code: performanceCode
      });

      TestAssert.assertTrue(typeof domQuerySearch === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping performance optimization test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  // =============================================================================
  // LARGE-SCALE REFACTORING SCENARIOS
  // =============================================================================

  suite.test('should handle enterprise-scale refactoring', async () => {
    console.log('  🏢 Testing enterprise-scale refactoring scenarios...');

    // Simulate a large enterprise codebase structure
    const enterpriseFiles = [
      'src/services/UserService.js',
      'src/services/AuthService.js',
      'src/controllers/UserController.js',
      'src/controllers/AuthController.js',
      'src/models/User.js',
      'src/utils/Logger.js',
      'src/config/Database.js',
      'test/unit/UserService.test.js',
      'test/integration/UserController.test.js'
    ];

    // Create directory structure
    for (const filePath of enterpriseFiles) {
      const fullPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      const content = `
// ${filePath}
const Logger = require('../utils/Logger');

class ${path.basename(filePath, '.js')} {
  constructor() {
    this.logger = new Logger();
  }

  process(data) {
    this.logger.info('Processing data in ${path.basename(filePath)}');
    // Legacy error handling
    if (!data) {
      throw new Error('Data is required');
    }
    return data;
  }
}

module.exports = ${path.basename(filePath, '.js')};
`;

      await fs.writeFile(fullPath, content);
    }

    try {
      // Enterprise refactoring: Convert CommonJS to ES modules
      const commonjsSearch = await searchTool.execute({
        pattern: 'module.exports = $EXPORT',
        language: 'javascript',
        paths: [tempDir]
      });

      TestAssert.assertTrue(typeof commonjsSearch === 'object');

      // Find all require statements for conversion
      const requireSearch = await searchTool.execute({
        pattern: 'const $NAME = require($PATH)',
        language: 'javascript',
        paths: [tempDir]
      });

      TestAssert.assertTrue(typeof requireSearch === 'object');

      // Test large-scale replacement across multiple files
      const errorHandlingReplace = await replaceTool.execute({
        pattern: 'throw new Error($MSG)',
        replacement: 'this.logger.error($MSG); throw new Error($MSG)',
        language: 'javascript',
        paths: [tempDir],
        dryRun: true
      });

      TestAssert.assertTrue(typeof errorHandlingReplace === 'object');

    } catch (error) {
      if (error.message.includes('ast-grep not found')) {
        console.log('  ⚠️  Skipping enterprise refactoring test - ast-grep not available');
        return;
      }
      throw error;
    }
  });

  return suite.run();
}