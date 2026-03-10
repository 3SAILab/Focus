import type { Rule, CodeSection, RuleViolation, Transformation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(
  ruleId: string,
  section: CodeSection,
  description: string,
  refined: string,
): RuleViolation {
  return {
    ruleId,
    severity: 'standard',
    location: section,
    description,
    suggestedFix: {
      ruleId,
      filePath: section.filePath,
      original: section.content,
      refined,
      startLine: section.startLine,
      endLine: section.endLine,
    },
  };
}

function makeTransformation(
  ruleId: string,
  section: CodeSection,
  refined: string,
): Transformation {
  return {
    ruleId,
    filePath: section.filePath,
    original: section.content,
    refined,
    startLine: section.startLine,
    endLine: section.endLine,
  };
}

/** Convert a string to camelCase. */
function toCamelCase(name: string): string {
  // Already camelCase (starts lowercase, no underscores/hyphens)
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return name;

  // Handle snake_case and kebab-case
  if (name.includes('_') || name.includes('-')) {
    return name
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part, i) =>
        i === 0
          ? part.toLowerCase()
          : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
      )
      .join('');
  }

  // Handle PascalCase → camelCase
  if (/^[A-Z]/.test(name)) {
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  return name;
}

/** Convert a string to PascalCase. */
function toPascalCase(name: string): string {
  // Already PascalCase
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return name;

  // Handle snake_case and kebab-case
  if (name.includes('_') || name.includes('-')) {
    return name
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');
  }

  // Handle camelCase → PascalCase
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ---------------------------------------------------------------------------
// Rule: ts.naming.camelCase
// Detect non-camelCase local variables, function parameters, and unexported
// functions. Requirement 9.1
// ---------------------------------------------------------------------------

/**
 * Matches local variable declarations (const/let/var) that are NOT exported
 * and whose name is not camelCase.
 *
 * Also matches function parameters and unexported function names.
 */

function isCamelCase(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

/** Check if a name is a constant (ALL_CAPS). */
function isConstantCase(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

function findNonCamelCaseLocals(content: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip exported declarations
    if (trimmed.startsWith('export ')) continue;

    // Check local variable declarations
    const varMatch = trimmed.match(/^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:;]/);
    if (varMatch) {
      const name = varMatch[1];
      // Skip CONSTANT_CASE (convention for constants)
      if (isConstantCase(name)) continue;
      // Skip camelCase (already correct)
      if (isCamelCase(name)) continue;
      violations.push(name);
    }

    // Check unexported function names
    const fnMatch = trimmed.match(/^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/);
    if (fnMatch && !trimmed.startsWith('export')) {
      const name = fnMatch[1];
      // Unexported functions should be camelCase (not PascalCase)
      if (!isCamelCase(name)) {
        violations.push(name);
      }
    }
  }

  return violations;
}

function findNonCamelCaseParams(content: string): string[] {
  const violations: string[] = [];
  // Match function parameter lists
  const fnParamPattern = /(?:function\s+\w+\s*|=>\s*)\(([^)]*)\)/g;
  const simpleParamPattern = /\(([^)]*)\)\s*(?::\s*\w+)?\s*(?:=>|{)/g;

  const patterns = [fnParamPattern, simpleParamPattern];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const paramList = match[1];
      if (!paramList.trim()) continue;

      // Extract parameter names (handle destructuring, type annotations)
      const params = paramList.split(',');
      for (const param of params) {
        const trimmed = param.trim();
        // Skip destructured params like { foo, bar }
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) continue;
        // Extract just the name (before : type annotation)
        const nameMatch = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)/);
        if (nameMatch) {
          const name = nameMatch[1];
          if (!isCamelCase(name) && !isConstantCase(name)) {
            violations.push(name);
          }
        }
      }
    }
  }

  return violations;
}

const camelCaseRule: Rule = {
  id: 'ts.naming.camelCase',
  language: 'typescript',
  category: 'naming',
  priority: 20,

  match(section: CodeSection): RuleViolation | null {
    const localViolations = findNonCamelCaseLocals(section.content);
    const paramViolations = findNonCamelCaseParams(section.content);
    const allViolations = [...new Set([...localViolations, ...paramViolations])];

    if (allViolations.length === 0) return null;

    return makeViolation(
      this.id,
      section,
      `Non-camelCase identifiers found: ${allViolations.join(', ')}`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;
    const localViolations = findNonCamelCaseLocals(section.content);
    const paramViolations = findNonCamelCaseParams(section.content);
    const allViolations = [...new Set([...localViolations, ...paramViolations])];

    for (const name of allViolations) {
      const camel = toCamelCase(name);
      if (camel !== name) {
        // Replace all occurrences of the identifier (word boundary)
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        refined = refined.replace(regex, camel);
      }
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.naming.PascalCase
// Detect non-PascalCase React components, interfaces, and type aliases.
// Requirement 9.2
// ---------------------------------------------------------------------------

function isPascalCase(name: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function findNonPascalCaseTypes(content: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Check interface declarations: interface myInterface {
    const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
    if (interfaceMatch) {
      const name = interfaceMatch[1];
      if (!isPascalCase(name)) {
        violations.push(name);
      }
    }

    // Check type alias declarations: type myType = ...
    const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=<]/);
    if (typeMatch) {
      const name = typeMatch[1];
      if (!isPascalCase(name)) {
        violations.push(name);
      }
    }

    // Check React component declarations (function starting with lowercase that returns JSX)
    // We detect: function componentName(...) patterns where the function body contains JSX
    const componentFnMatch = trimmed.match(
      /^(?:export\s+)?(?:async\s+)?function\s+([a-z_][A-Za-z0-9_]*)\s*\(/,
    );
    if (componentFnMatch) {
      const name = componentFnMatch[1];
      // Check if the section content suggests this is a React component (contains JSX)
      const fnBodyStart = content.indexOf(trimmed);
      const afterFn = content.slice(fnBodyStart);
      if (afterFn.includes('return') && (afterFn.includes('<') && afterFn.includes('/>'))) {
        violations.push(name);
      }
    }

    // Check arrow component: const myComponent = (...) => { ... return <JSX /> }
    const arrowComponentMatch = trimmed.match(
      /^(?:export\s+)?const\s+([a-z_][A-Za-z0-9_]*)\s*=\s*(?:async\s+)?\(/,
    );
    if (arrowComponentMatch) {
      const name = arrowComponentMatch[1];
      const fnBodyStart = content.indexOf(trimmed);
      const afterFn = content.slice(fnBodyStart);
      if (afterFn.includes('<') && afterFn.includes('/>')) {
        violations.push(name);
      }
    }
  }

  return [...new Set(violations)];
}

const pascalCaseRule: Rule = {
  id: 'ts.naming.PascalCase',
  language: 'typescript',
  category: 'naming',
  priority: 21,

  match(section: CodeSection): RuleViolation | null {
    const violations = findNonPascalCaseTypes(section.content);
    if (violations.length === 0) return null;

    return makeViolation(
      this.id,
      section,
      `Non-PascalCase type/component names found: ${violations.join(', ')}`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;
    const violations = findNonPascalCaseTypes(section.content);

    for (const name of violations) {
      const pascal = toPascalCase(name);
      if (pascal !== name) {
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        refined = refined.replace(regex, pascal);
      }
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.naming.descriptive
// Detect single-letter variables except in short lambdas and loop indices.
// Requirement 9.4
// ---------------------------------------------------------------------------

/**
 * Allowed single-letter names:
 * - Loop indices: i, j, k, n
 * - Short lambda parameters (arrow functions on a single line)
 */
const LOOP_INDEX_NAMES = new Set(['i', 'j', 'k', 'n']);

function findSingleLetterViolations(content: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // Check for loop index declarations — these are allowed
    // for (let i = 0; ...) or for (const i of ...)
    const isForLoop = /^\s*for\s*\(/.test(line);

    // Check variable declarations: const/let/var x = ...
    const varDeclPattern = /\b(?:const|let|var)\s+([a-zA-Z])\s*[=:;,]/g;
    let match;
    while ((match = varDeclPattern.exec(line)) !== null) {
      const name = match[1];
      // Allow loop indices in for loops
      if (isForLoop && LOOP_INDEX_NAMES.has(name)) continue;
      violations.push(name);
    }

    // Check function parameters — but allow short lambdas
    // Short lambda: (x) => expr (single line, no block body)
    const shortLambdaPattern = /\(([a-zA-Z])\)\s*=>\s*[^{]/;
    const blockLambdaParamPattern = /\(([a-zA-Z])\)\s*=>\s*\{/;
    const fnParamPattern = /function\s+\w+\s*\(([^)]*)\)/;

    // Short lambda params are allowed
    if (shortLambdaPattern.test(trimmed)) continue;

    // Block lambda with single-letter param is a violation
    const blockMatch = trimmed.match(blockLambdaParamPattern);
    if (blockMatch) {
      const name = blockMatch[1];
      if (!LOOP_INDEX_NAMES.has(name)) {
        violations.push(name);
      }
    }

    // Function params
    const fnMatch = trimmed.match(fnParamPattern);
    if (fnMatch) {
      const paramList = fnMatch[1];
      const params = paramList.split(',');
      for (const param of params) {
        const paramName = param.trim().match(/^([a-zA-Z])(?:\s*:|$|\s*,|\s*\))/);
        if (paramName) {
          const name = paramName[1];
          if (!LOOP_INDEX_NAMES.has(name)) {
            violations.push(name);
          }
        }
      }
    }
  }

  return [...new Set(violations)];
}

const descriptiveRule: Rule = {
  id: 'ts.naming.descriptive',
  language: 'typescript',
  category: 'naming',
  priority: 22,

  match(section: CodeSection): RuleViolation | null {
    const violations = findSingleLetterViolations(section.content);
    if (violations.length === 0) return null;

    return makeViolation(
      this.id,
      section,
      `Single-letter variable names found: ${violations.join(', ')}. Use descriptive names.`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    // For single-letter variables, we add a TODO comment suggesting renaming
    // since we can't automatically determine a descriptive name
    let refined = section.content;
    const violations = findSingleLetterViolations(section.content);

    if (violations.length > 0) {
      const comment = `// TODO: Rename single-letter variables to descriptive names: ${violations.join(', ')}`;
      refined = comment + '\n' + refined;
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Export all TypeScript naming rules
// ---------------------------------------------------------------------------

export const tsNamingRules: Rule[] = [
  camelCaseRule,
  pascalCaseRule,
  descriptiveRule,
];
