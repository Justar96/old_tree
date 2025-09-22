import { ValidationResult, ValidationError } from '../types/errors.js';

/**
 * Validates ast-grep patterns and emits structured diagnostics for tool consumers.
 */
export class EnhancedPatternValidator {
  private workspaceRoot: string;

  /**
   * Persist workspace context for language specific validation.
   */
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  validatePattern(pattern: string, language?: string, context?: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      diagnostics: {
        patternType: this.classifyPattern(pattern),
        metavariables: this.extractAndValidateMetavariables(pattern),
        languageCompatibility: this.checkLanguageCompatibility(pattern, language),
        complexity: this.assessPatternComplexity(pattern)
      }
    };

    // Basic syntax validation
    const syntaxValidation = this.validateSyntax(pattern);
    if (!syntaxValidation.valid) {
      result.valid = false;
      result.errors.push(...syntaxValidation.errors);
      result.warnings.push(...syntaxValidation.warnings);
    }

    // Metavariable validation (addresses QA Issue #1)
    const metavarValidation = this.validateMetavariables(pattern, language);
    if (!metavarValidation.valid) {
      result.valid = false;
      result.errors.push(...metavarValidation.errors);
      result.warnings.push(...metavarValidation.warnings);
    }

    // Language-specific validation (addresses QA Issue #5)
    if (language) {
      const langValidation = this.validateLanguageSpecificPattern(pattern, language);
      if (!langValidation.valid) {
        result.valid = false;
        result.errors.push(...langValidation.errors);
        result.warnings.push(...langValidation.warnings);
      }
    }

    // Pattern reliability assessment
    const reliabilityAssessment = this.assessPatternReliability(pattern, language);
    result.warnings.push(...reliabilityAssessment.warnings);
    result.diagnostics = { ...result.diagnostics, ...reliabilityAssessment.diagnostics };

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  validateNestedPattern(
    primaryPattern: string,
    insidePattern?: string,
    hasPattern?: string,
    notPattern?: string,
    language?: string
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      diagnostics: {
        complexity: 'nested',
        patterns: {
          primary: primaryPattern,
          inside: insidePattern,
          has: hasPattern,
          not: notPattern
        }
      }
    };

    // Validate primary pattern
    const primaryValidation = this.validatePattern(primaryPattern, language);
    if (!primaryValidation.valid) {
      result.valid = false;
      result.errors.push(`Primary pattern invalid: ${primaryValidation.errors.join(', ')}`);
    }

    // Validate contextual patterns
    if (insidePattern) {
      const insideValidation = this.validatePattern(insidePattern, language);
      if (!insideValidation.valid) {
        result.valid = false;
        result.errors.push(`Inside pattern invalid: ${insideValidation.errors.join(', ')}`);
      }

      // Check if inside pattern is suitable for nesting
      if (!this.isValidContainerPattern(insidePattern)) {
        result.warnings.push(`Inside pattern "${insidePattern}" may not be suitable as a container. Consider using patterns with block structures like "class $NAME { $$$ }" or "function $NAME() { $$$ }"`);
      }
    }

    if (hasPattern) {
      const hasValidation = this.validatePattern(hasPattern, language);
      if (!hasValidation.valid) {
        result.valid = false;
        result.errors.push(`Has pattern invalid: ${hasValidation.errors.join(', ')}`);
      }
    }

    if (notPattern) {
      const notValidation = this.validatePattern(notPattern, language);
      if (!notValidation.valid) {
        result.valid = false;
        result.errors.push(`Not pattern invalid: ${notValidation.errors.join(', ')}`);
      }
    }

    // Check for pattern compatibility
    const compatibilityCheck = this.checkPatternCompatibility(primaryPattern, insidePattern, hasPattern, notPattern);
    if (!compatibilityCheck.valid) {
      result.valid = false;
      result.errors.push(...compatibilityCheck.errors);
    }
    result.warnings.push(...compatibilityCheck.warnings);

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private validateMetavariables(pattern: string, language?: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    const metavars = this.extractAndValidateMetavariables(pattern);

    // Check for problematic metavariable patterns identified by QA
    if (metavars.problematic.length > 0) {
      result.warnings.push(`Potentially unreliable metavariables detected: ${metavars.problematic.join(', ')}`);

      // Specific guidance for $ARGS vs $$$ issue
      if (metavars.problematic.some(mv => mv.includes('ARGS') || mv.includes('PARAMS'))) {
        result.warnings.push(`QA GUIDANCE: Metavariable $ARGS may have low reliability (20% success rate). Consider using $$$ for function parameters instead, which has 80% success rate.`);

        // Suggest alternative patterns
        if (language === 'python' && pattern.includes('def')) {
          result.warnings.push(`SUGGESTION: Use "def $FUNC_NAME($$$): $$$" instead of "def $FUNC_NAME($ARGS): $$$" for better reliability`);
        }
        if ((language === 'javascript' || language === 'typescript') && pattern.includes('function')) {
          result.warnings.push(`SUGGESTION: Use "function $FUNC_NAME($$$) { $$$ }" instead of "function $FUNC_NAME($ARGS) { $$$ }" for better reliability`);
        }
      }
    }

    // Check for invalid metavariable syntax
    const invalidMetavars = pattern.match(/\$[a-z][a-zA-Z0-9_]*/g);
    if (invalidMetavars) {
      result.valid = false;
      result.errors.push(`Invalid metavariable syntax: ${invalidMetavars.join(', ')}. Metavariables must use UPPERCASE: $VAR, $NAME, $ARGS, etc.`);
    }

    // Check for incomplete multi-metavariables
    const incompleteMulti = pattern.match(/\$\$(?!\$)[a-zA-Z_]/g);
    if (incompleteMulti) {
      result.valid = false;
      result.errors.push(`Incomplete multi-metavariable syntax: ${incompleteMulti.join(', ')}. Use $$$ for multi-node matching.`);
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private extractAndValidateMetavariables(pattern: string): {
    single: string[];
    multi: string[];
    problematic: string[];
    reliable: string[];
  } {
    const single: string[] = [];
    const multi: string[] = [];
    const problematic: string[] = [];
    const reliable: string[] = [];

    // Extract single metavariables: $VAR, $_, $VAR1
    const singleMatches = pattern.match(/\$[A-Z_][A-Z0-9_]*/g) || [];
    for (const match of singleMatches) {
      const varName = match.slice(1);
      single.push(varName);

      // Identify potentially problematic metavariables based on QA findings
      if (['ARGS', 'PARAMS', 'ARGUMENTS'].includes(varName)) {
        problematic.push(match);
      } else {
        reliable.push(match);
      }
    }

    // Extract multi-metavariables: $$$VAR, $$$
    const multiMatches = pattern.match(/\$\$\$[A-Z_]*[A-Z0-9_]*/g) || [];
    for (const match of multiMatches) {
      const varName = match.slice(3) || 'BODY';
      multi.push(varName);
      reliable.push(match); // Multi-metavariables are generally more reliable
    }

    return { single, multi, problematic, reliable };
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private assessPatternReliability(pattern: string, language?: string): {
    warnings: string[];
    diagnostics: any;
  } {
    const warnings: string[] = [];
    const diagnostics: any = {
      reliabilityScore: 100, // Start with 100%
      issues: []
    };

    // QA Issue #1: Function argument patterns have low reliability
    if (pattern.includes('$ARGS') || pattern.includes('$PARAMS')) {
      diagnostics.reliabilityScore -= 60; // QA reported 20% success rate
      diagnostics.issues.push('Function argument metavariables have low reliability');
      warnings.push('Pattern contains $ARGS/$PARAMS which have low reliability. Consider using $$$ instead.');
    }

    // QA Issue #2: Nested patterns often fail
    if (this.isNestedPattern(pattern)) {
      diagnostics.reliabilityScore -= 40;
      diagnostics.issues.push('Nested patterns have reliability issues');
      warnings.push('Complex nested patterns may fail. Consider breaking into simpler components or using contextual rules.');
    }

    // QA Issue #4: Exception handling patterns often fail
    if (this.isExceptionPattern(pattern)) {
      diagnostics.reliabilityScore -= 30;
      diagnostics.issues.push('Exception handling patterns have known issues');
      warnings.push('Exception handling patterns may not match as expected. Verify with simple test cases.');
    }

    // Language-specific reliability (QA Issue #5)
    if (language === 'javascript' && this.isFunctionPattern(pattern)) {
      diagnostics.reliabilityScore -= 20; // QA reported 25% success rate for JS functions
      diagnostics.issues.push('JavaScript function patterns have reduced reliability');
      warnings.push('JavaScript function patterns have known reliability issues. Test thoroughly.');
    }

    diagnostics.reliabilityScore = Math.max(0, diagnostics.reliabilityScore);

    return { warnings, diagnostics };
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private validateLanguageSpecificPattern(pattern: string, language: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    switch (language.toLowerCase()) {
      case 'python':
        return this.validatePythonPattern(pattern);
      case 'javascript':
      case 'typescript':
        return this.validateJavaScriptPattern(pattern);
      case 'java':
        return this.validateJavaPattern(pattern);
      default:
        result.warnings.push(`Language-specific validation not available for "${language}". Pattern may need adjustment.`);
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private validatePythonPattern(pattern: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Function definition patterns
    if (pattern.includes('def') && !pattern.includes(':')) {
      result.errors.push('Python function patterns must include colon: def $NAME($ARGS): $$$');
    }

    // Class definition patterns
    if (pattern.includes('class') && !pattern.includes(':')) {
      result.errors.push('Python class patterns must include colon: class $NAME: $$$ or class $NAME($BASE): $$$');
    }

    // Exception handling patterns (addresses QA Issue #4)
    if (pattern.includes('except') && !pattern.includes('try')) {
      result.warnings.push('Exception patterns work better when including try block: try: $$$ except $EXCEPTION: $$$');
    }

    // Import patterns
    if (pattern.includes('import') && pattern.includes('from') && !pattern.match(/from .+ import/)) {
      result.warnings.push('Python import patterns should follow "from $MODULE import $ITEM" structure');
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private validateJavaScriptPattern(pattern: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Function patterns - QA reported low success rate
    if (pattern.includes('function')) {
      if (!pattern.includes('(') || !pattern.includes(')')) {
        result.errors.push('JavaScript function patterns need parentheses: function $NAME($ARGS) { $$$ }');
      }

      // Specific guidance for QA Issue #5
      result.warnings.push('QA WARNING: JavaScript function patterns have ~25% success rate. Test thoroughly and consider alternatives.');

      if (pattern.includes('$ARGS')) {
        result.warnings.push('RELIABILITY ISSUE: $ARGS in JavaScript functions may not match reliably. Consider using $$$ instead.');
      }
    }

    // Class method patterns (addresses QA Issue #2)
    if (pattern.includes('class') && pattern.includes('$')) {
      if (!this.isValidJavaScriptClassPattern(pattern)) {
        result.warnings.push('JavaScript class method patterns are complex. Consider using separate patterns for class and methods.');
      }
    }

    // Arrow function patterns
    if (pattern.includes('=>')) {
      if (!pattern.match(/\$\w+\s*=.*=>/)) {
        result.warnings.push('Arrow function patterns should follow: const $NAME = ($ARGS) => $BODY structure');
      }
    }

    // Async function patterns
    if (pattern.includes('async')) {
      result.warnings.push('Async function patterns may need special handling. Test with both async/await and Promise syntax.');
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private validateJavaPattern(pattern: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Method patterns
    if (pattern.includes('public') || pattern.includes('private') || pattern.includes('protected')) {
      if (!pattern.includes('(') || !pattern.includes(')')) {
        result.errors.push('Java method patterns need parentheses: public $TYPE $NAME($ARGS) { $$$ }');
      }
    }

    // Class patterns
    if (pattern.includes('class') && !pattern.includes('{')) {
      result.warnings.push('Java class patterns usually need braces: class $NAME { $$$ }');
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private isValidContainerPattern(pattern: string): boolean {
    // Container patterns should have block structures
    const containerIndicators = [
      /class\s+\$\w+.*\{\s*\$\$\$/,  // class $NAME { $$$ }
      /function\s+\$\w+.*\{\s*\$\$\$/,  // function $NAME() { $$$ }
      /def\s+\$\w+.*:\s*\$\$\$/,     // def $NAME(): $$$
      /try\s*\{\s*\$\$\$/,           // try { $$$ }
      /if\s*\(.*\)\s*\{\s*\$\$\$/   // if (...) { $$$ }
    ];

    return containerIndicators.some(indicator => indicator.test(pattern));
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private checkPatternCompatibility(
    primaryPattern: string,
    insidePattern?: string,
    hasPattern?: string,
    notPattern?: string
  ): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Check if patterns have compatible metavariables
    const primaryMetavars = this.extractAndValidateMetavariables(primaryPattern);

    if (insidePattern) {
      const insideMetavars = this.extractAndValidateMetavariables(insidePattern);
      // Check for metavariable conflicts
      const conflicts = primaryMetavars.single.filter(mv => insideMetavars.single.includes(mv));
      if (conflicts.length > 0) {
        result.warnings.push(`Metavariable conflicts between primary and inside patterns: ${conflicts.join(', ')}`);
      }
    }

    return result;
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private classifyPattern(pattern: string): string {
    if (this.isFunctionPattern(pattern)) return 'function';
    if (this.isClassPattern(pattern)) return 'class';
    if (this.isImportPattern(pattern)) return 'import';
    if (this.isExceptionPattern(pattern)) return 'exception';
    if (this.isVariablePattern(pattern)) return 'variable';
    if (this.isNestedPattern(pattern)) return 'nested';
    return 'simple';
  }

  /**
   * Validate an ast-grep pattern and gather structured diagnostics for tooling.
   */
  private assessPatternComplexity(pattern: string): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    let score = 0;

    // Count metavariables
    const metavarCount = (pattern.match(/\$[A-Z_][A-Z0-9_]*/g) || []).length;
    score += metavarCount;

    // Multi-metavariables add complexity
    const multiMetavarCount = (pattern.match(/\$\$\$/g) || []).length;
    score += multiMetavarCount * 2;

    // Nested structures add complexity
    if (this.isNestedPattern(pattern)) score += 3;

    // Keywords add some complexity
    const keywords = ['class', 'function', 'def', 'try', 'catch', 'except', 'if', 'for', 'while'];
    const keywordCount = keywords.filter(kw => pattern.includes(kw)).length;
    score += keywordCount;

    if (score <= 2) return 'simple';
    if (score <= 5) return 'moderate';
    if (score <= 10) return 'complex';
    return 'very_complex';
  }

  private checkLanguageCompatibility(pattern: string, language?: string): string[] {
    const compatibility: string[] = [];

    if (!language) {
      compatibility.push('Language not specified - pattern may not parse correctly');
      return compatibility;
    }

    // Check for language-specific keywords
    const pythonKeywords = ['def', 'class', 'import', 'from', 'try', 'except'];
    const jsKeywords = ['function', 'class', 'const', 'let', 'var', 'import', 'export'];
    const javaKeywords = ['public', 'private', 'protected', 'class', 'interface', 'static'];

    const lang = language.toLowerCase();

    if (lang === 'python') {
      const hasJsKeywords = jsKeywords.some(kw => pattern.includes(kw) && !pythonKeywords.includes(kw));
      if (hasJsKeywords) {
        compatibility.push('Pattern contains JavaScript-specific keywords that may not work in Python');
      }
    } else if (lang === 'javascript' || lang === 'typescript') {
      const hasPythonKeywords = pythonKeywords.some(kw => pattern.includes(kw) && !jsKeywords.includes(kw));
      if (hasPythonKeywords) {
        compatibility.push('Pattern contains Python-specific keywords that may not work in JavaScript');
      }
    }

    return compatibility;
  }

  private validateSyntax(pattern: string): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [], warnings: [] };

    // Check for basic syntax issues
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack: string[] = [];

    for (const char of pattern) {
      if (char in brackets) {
        stack.push(brackets[char as keyof typeof brackets]);
      } else if (Object.values(brackets).includes(char)) {
        if (stack.pop() !== char) {
          result.valid = false;
          result.errors.push('Pattern has unmatched brackets, parentheses, or braces');
          break;
        }
      }
    }

    if (stack.length > 0) {
      result.valid = false;
      result.errors.push('Pattern has unclosed brackets, parentheses, or braces');
    }

    return result;
  }

  // Pattern type detection helpers
  private isFunctionPattern(pattern: string): boolean {
    return /\b(function|def|func)\b/.test(pattern);
  }

  private isClassPattern(pattern: string): boolean {
    return /\bclass\b/.test(pattern);
  }

  private isImportPattern(pattern: string): boolean {
    return /\b(import|from|#include)\b/.test(pattern);
  }

  private isExceptionPattern(pattern: string): boolean {
    return /\b(try|catch|except|finally|throw)\b/.test(pattern);
  }

  private isVariablePattern(pattern: string): boolean {
    return /\b(var|let|const|def|int|string)\b/.test(pattern);
  }

  private isNestedPattern(pattern: string): boolean {
    // Simple heuristic for nested patterns
    const blockCount = (pattern.match(/\{\s*\$\$\$/g) || []).length;
    const metavarCount = (pattern.match(/\$[A-Z_]/g) || []).length;
    return blockCount > 1 || (blockCount > 0 && metavarCount > 3);
  }

  private isValidJavaScriptClassPattern(pattern: string): boolean {
    // Check if it's a well-formed JavaScript class pattern
    return /class\s+\$\w+.*\{.*\}/.test(pattern.replace(/\s+/g, ' '));
  }
}


