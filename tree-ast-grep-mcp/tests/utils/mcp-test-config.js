/**
 * MCP Test Configuration
 * Centralized test configuration following Inspector patterns
 */

export const TEST_CONFIG = {
  // Test timeouts (in milliseconds)
  TIMEOUTS: {
    SERVER_START: 10000,
    MESSAGE_RESPONSE: 5000,
    TOOL_EXECUTION: 15000,
    LONG_RUNNING: 30000
  },

  // MCP Protocol constants
  MCP: {
    PROTOCOL_VERSION: '2024-11-05',
    CLIENT_INFO: {
      name: 'tree-ast-grep-test-client',
      version: '1.0.0'
    }
  },

  // Expected tools and their schemas
  EXPECTED_TOOLS: {
    ast_search: {
      name: 'ast_search',
      requiredParams: ['pattern'],
      optionalParams: ['language', 'paths', 'code', 'maxMatches', 'context']
    },
    ast_replace: {
      name: 'ast_replace',
      requiredParams: ['pattern', 'replacement'],
      optionalParams: ['language', 'paths', 'code', 'dryRun']
    },
    ast_run_rule: {
      name: 'ast_run_rule',
      requiredParams: ['id', 'language', 'pattern'],
      optionalParams: ['message', 'paths', 'where', 'fix', 'severity']
    }
  },

  // Test data patterns
  TEST_PATTERNS: {
    javascript: {
      simple: {
        pattern: 'console.log($ARG)',
        code: 'console.log("hello world");',
        expectedMatch: true
      },
      function: {
        pattern: 'function $NAME($PARAMS) { $$$ }',
        code: 'function testFunc(a, b) { return a + b; }',
        expectedMatch: true
      },
      class: {
        pattern: 'class $NAME { $$$ }',
        code: 'class TestClass { constructor() {} }',
        expectedMatch: true
      },
      arrow: {
        pattern: '($PARAMS) => $BODY',
        code: 'const fn = (x, y) => x + y;',
        expectedMatch: true
      }
    },
    typescript: {
      interface: {
        pattern: 'interface $NAME { $$$ }',
        code: 'interface User { name: string; age: number; }',
        expectedMatch: true
      },
      generic: {
        pattern: 'function $NAME<$T>($PARAMS): $RET { $$$ }',
        code: 'function identity<T>(arg: T): T { return arg; }',
        expectedMatch: true
      }
    },
    python: {
      function: {
        pattern: 'def $NAME($PARAMS): $$$',
        code: 'def hello(name):\n    print(f"Hello {name}")',
        expectedMatch: true
      },
      class: {
        pattern: 'class $NAME: $$$',
        code: 'class Person:\n    def __init__(self):\n        pass',
        expectedMatch: true
      }
    }
  },

  // Error test cases
  ERROR_CASES: {
    invalid_pattern: {
      pattern: 'invalid(((syntax',
      expectedError: true,
      errorType: 'ValidationError'
    },
    missing_pattern: {
      arguments: { language: 'javascript' },
      expectedError: true,
      errorType: 'ValidationError'
    },
    unsupported_language: {
      pattern: 'test',
      language: 'unsupported-lang',
      expectedError: true,
      errorType: 'ValidationError'
    }
  },

  // Performance benchmarks
  PERFORMANCE: {
    MAX_SEARCH_TIME: 2000,      // 2 seconds for search
    MAX_REPLACE_TIME: 3000,     // 3 seconds for replace
    MAX_SCAN_TIME: 5000,        // 5 seconds for scan
    MAX_MEMORY_MB: 100          // 100MB memory usage
  },

  // Test file templates
  TEST_FILES: {
    simple_js: `
function testFunction() {
  console.log("hello world");
  return true;
}

class TestClass {
  constructor() {
    this.value = 42;
  }
}
`,
    complex_js: `
import React from 'react';

function Component({ name, children }) {
  const [state, setState] = useState(false);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  return (
    <div className={state ? 'active' : 'inactive'}>
      <h1>{name}</h1>
      {children}
    </div>
  );
}

export default Component;
`,
    typescript_sample: `
interface User {
  name: string;
  age: number;
  email?: string;
}

class UserService {
  private users: User[] = [];
  
  async getUser(id: string): Promise<User | null> {
    console.log(\`Fetching user: \${id}\`);
    return this.users.find(u => u.name === id) || null;
  }
}
`,
    python_sample: `
class Calculator:
    def __init__(self):
        self.history = []
    
    def add(self, a, b):
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def multiply(self, a, b):
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result

def main():
    calc = Calculator()
    print(calc.add(5, 3))
    print(calc.multiply(4, 6))
`
  }
};

/**
 * MCP Message Builder
 * Helper for building proper MCP protocol messages
 */
export class MCPMessageBuilder {
  constructor() {
    this.messageId = 0;
  }

  nextId() {
    return ++this.messageId;
  }

  initialize() {
    return {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: TEST_CONFIG.MCP.PROTOCOL_VERSION,
        capabilities: { tools: {} },
        clientInfo: TEST_CONFIG.MCP.CLIENT_INFO
      }
    };
  }

  initialized() {
    return {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    };
  }

  listTools() {
    return {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/list',
      params: {}
    };
  }

  callTool(toolName, args) {
    return {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
  }
}

/**
 * Test Validation Helpers
 */
export class MCPValidator {
  static validateInitializeResponse(response) {
    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }
    
    if (!response.result) {
      throw new Error('Initialize response missing result');
    }
    
    if (!response.result.capabilities) {
      throw new Error('Initialize response missing capabilities');
    }
    
    if (!response.result.serverInfo) {
      throw new Error('Initialize response missing serverInfo');
    }
    
    return true;
  }

  static validateToolsListResponse(response) {
    if (response.error) {
      throw new Error(`Tools list failed: ${response.error.message}`);
    }
    
    if (!response.result || !Array.isArray(response.result.tools)) {
      throw new Error('Tools list response invalid format');
    }
    
    // Validate each tool
    for (const tool of response.result.tools) {
      if (!tool.name || typeof tool.name !== 'string') {
        throw new Error(`Tool missing name: ${JSON.stringify(tool)}`);
      }
      
      if (!tool.description || typeof tool.description !== 'string') {
        throw new Error(`Tool missing description: ${tool.name}`);
      }
      
      if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
        throw new Error(`Tool invalid inputSchema: ${tool.name}`);
      }
    }
    
    return true;
  }

  static validateToolCallResponse(response, toolName) {
    if (response.error) {
      throw new Error(`Tool call ${toolName} failed: ${response.error.message}`);
    }
    
    if (!response.result) {
      throw new Error(`Tool call ${toolName} missing result`);
    }
    
    if (!Array.isArray(response.result.content)) {
      throw new Error(`Tool call ${toolName} result.content is not array`);
    }
    
    // Validate content blocks
    for (const content of response.result.content) {
      if (!content.type) {
        throw new Error(`Content block missing type: ${JSON.stringify(content)}`);
      }
      
      if (content.type === 'text' && typeof content.text !== 'string') {
        throw new Error(`Text content block missing text: ${JSON.stringify(content)}`);
      }
    }
    
    return true;
  }

  static validateExpectedTools(actualTools) {
    const actualNames = actualTools.map(t => t.name);
    
    for (const expectedName of Object.keys(TEST_CONFIG.EXPECTED_TOOLS)) {
      if (!actualNames.includes(expectedName)) {
        throw new Error(`Missing expected tool: ${expectedName}`);
      }
    }
    
    return true;
  }
}