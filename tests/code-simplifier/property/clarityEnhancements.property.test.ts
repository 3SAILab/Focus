/**
 * Property tests for TypeScript clarity enhancement rules.
 *
 * Feature: code-simplifier
 * Properties 13, 14, 15
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tsClarityRules } from '../../../frontend/src/code-simplifier/rules/ts.clarity';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

// Resolve rules from the exported array
const guardClausesRule = tsClarityRules.find((r) => r.id === 'ts.clarity.guard-clauses')!;
const removeRedundancyRule = tsClarityRules.find((r) => r.id === 'ts.clarity.remove-redundancy')!;
const noNestedTernaryRule = tsClarityRules.find((r) => r.id === 'ts.clarity.no-nested-ternary')!;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Compute the maximum brace nesting depth in a code string. */
function getNestingDepth(content: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  for (const ch of content) {
    if (ch === '{') {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    } else if (ch === '}') {
      currentDepth--;
    }
  }
  return maxDepth;
}

/** Arbitrary for a simple identifier. */
const arbIdentifier: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 3,
    maxLength: 10,
  })
  .filter((s) => s.length >= 3);

/** Arbitrary for a simple boolean condition expression. */
const arbCondition: fc.Arbitrary<string> = fc.oneof(
  arbIdentifier.map((name) => `${name} !== null`),
  arbIdentifier.map((name) => `${name} > 0`),
  arbIdentifier.map((name) => `typeof ${name} === 'string'`),
  arbIdentifier.map((name) => `${name}`),
);

/** Helper to build a CodeSection from content. */
function makeSection(content: string, filePath = 'src/example.ts'): CodeSection {
  const lines = content.split('\n');
  return {
    filePath,
    startLine: 1,
    endLine: lines.length,
    content,
  };
}

// ---------------------------------------------------------------------------
// Property 13: Nesting Depth Reduction
//
// For any code section where guard clauses or early returns are applicable,
// the maximum nesting depth after refinement must be less than or equal to
// the nesting depth before refinement.
//
// Feature: code-simplifier, Property 13: Nesting Depth Reduction
// Validates: Requirements 4.1
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Generators for Property 13
// ---------------------------------------------------------------------------

/**
 * Generates a code section with deep if/else nesting (3+ levels) that
 * contains an if-branch with a return statement followed by an else block,
 * which is the pattern the guard-clauses rule can transform.
 */
const arbDeepNestedIfElse: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbCondition, arbCondition, arbCondition)
  .map(([fnName, cond1, cond2, cond3]) => {
    // Build a deeply nested if/else structure with a return in the if-branch
    const content = [
      `function ${fnName}(input: unknown) {`,
      `  if (${cond1}) {`,
      `    return null;`,
      `  } else {`,
      `    if (${cond2}) {`,
      `      return null;`,
      `    } else {`,
      `      if (${cond3}) {`,
      `        return 'deep';`,
      `      } else {`,
      `        return 'default';`,
      `      }`,
      `    }`,
      `  }`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/**
 * Generates a code section with moderate nesting (2 levels) that still
 * contains the if-return-else pattern the rule can match.
 */
const arbModerateNestedIfElse: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbCondition, arbCondition)
  .map(([fnName, cond1, cond2]) => {
    const content = [
      `function ${fnName}(value: string) {`,
      `  if (${cond1}) {`,
      `    if (${cond2}) {`,
      `      return 'found';`,
      `    } else {`,
      `      return 'not found';`,
      `    }`,
      `  }`,
      `  return null;`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/** Combined generator for sections with deep nesting. */
const arbNestedSection: fc.Arbitrary<CodeSection> = fc.oneof(
  arbDeepNestedIfElse,
  arbModerateNestedIfElse,
);

// ---------------------------------------------------------------------------
// Property 13 tests
// ---------------------------------------------------------------------------

describe('Property 13: Nesting Depth Reduction', () => {
  it(
    'nesting depth does not increase after guard-clauses transform',
    () => {
      fc.assert(
        fc.property(arbNestedSection, (section) => {
          const originalDepth = getNestingDepth(section.content);
          const result = guardClausesRule.transform(section);
          const refinedDepth = getNestingDepth(result.refined);
          expect(refinedDepth).toBeLessThanOrEqual(originalDepth);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves the original content in metadata',
    () => {
      fc.assert(
        fc.property(arbNestedSection, (section) => {
          const result = guardClausesRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.clarity.guard-clauses');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'deeply nested sections are detected by match()',
    () => {
      fc.assert(
        fc.property(arbDeepNestedIfElse, (section) => {
          const violation = guardClausesRule.match(section);
          // Deep nesting (3+ levels with if/else) should be detected
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.clarity.guard-clauses');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 14: Redundancy Removal
//
// For any code section after refinement, there must be no unused variables,
// unreachable code blocks, or duplicate logic that existed in the original.
//
// Feature: code-simplifier, Property 14: Redundancy Removal
// Validates: Requirements 4.2
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Generators for Property 14
// ---------------------------------------------------------------------------

/**
 * Generates a code section containing unused variable declarations.
 * The variable is declared but never referenced again in the code.
 */
const arbUnusedVarSection: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbIdentifier, arbIdentifier)
  .filter(([a, b, c]) => a !== b && b !== c && a !== c)
  .map(([unusedVar, usedVar, fnName]) => {
    const content = [
      `function ${fnName}() {`,
      `  const ${unusedVar} = 'never used';`,
      `  const ${usedVar} = 42;`,
      `  return ${usedVar};`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/**
 * Generates a code section with duplicate consecutive lines.
 * Lines must be >10 chars to be detected as duplicates by the rule.
 */
const arbDuplicateLineSection: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbIdentifier)
  .filter(([a, b]) => a !== b)
  .map(([varName, fnName]) => {
    const duplicateLine = `  console.log(${varName});`;
    const content = [
      `function ${fnName}() {`,
      `  const ${varName} = 'hello world';`,
      duplicateLine,
      duplicateLine,
      `  return ${varName};`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/**
 * Generates a code section with unreachable code after a return statement.
 */
const arbUnreachableCodeSection: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbIdentifier)
  .filter(([a, b]) => a !== b)
  .map(([varName, fnName]) => {
    const content = [
      `function ${fnName}() {`,
      `  return 'early exit';`,
      `  const ${varName} = 'unreachable';`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/** Combined generator for sections with redundancies. */
const arbRedundantSection: fc.Arbitrary<CodeSection> = fc.oneof(
  arbUnusedVarSection,
  arbDuplicateLineSection,
  arbUnreachableCodeSection,
);

// ---------------------------------------------------------------------------
// Property 14 tests
// ---------------------------------------------------------------------------

describe('Property 14: Redundancy Removal', () => {
  it(
    'unused variables are removed after transform',
    () => {
      fc.assert(
        fc.property(arbUnusedVarSection, (section) => {
          const result = removeRedundancyRule.transform(section);
          // Extract variable names that were declared only once in the original
          const declPattern = /(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?\s*=/g;
          let m: RegExpExecArray | null;
          const origDecls: string[] = [];
          while ((m = declPattern.exec(section.content)) !== null) {
            origDecls.push(m[1]);
          }
          for (const varName of origDecls) {
            const nameRegex = new RegExp(`\\b${varName}\\b`, 'g');
            const origMatches = section.content.match(nameRegex);
            // If the variable appeared only once (its declaration), it was unused
            if (origMatches && origMatches.length === 1) {
              // It should be removed from the refined output
              const refinedMatches = result.refined.match(nameRegex);
              expect(refinedMatches).toBeNull();
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'duplicate consecutive lines are removed after transform',
    () => {
      fc.assert(
        fc.property(arbDuplicateLineSection, (section) => {
          const result = removeRedundancyRule.transform(section);
          const lines = result.refined.split('\n');
          // Check no two consecutive lines are identical (for lines > 10 chars)
          for (let i = 1; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            const prevTrimmed = lines[i - 1].trim();
            if (trimmed.length > 10) {
              expect(trimmed).not.toBe(prevTrimmed);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects sections with redundancies',
    () => {
      fc.assert(
        fc.property(arbRedundantSection, (section) => {
          const violation = removeRedundancyRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.clarity.remove-redundancy');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbRedundantSection, (section) => {
          const result = removeRedundancyRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.clarity.remove-redundancy');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 15: No Nested Ternaries
//
// For any code section after refinement, there must be no nested ternary
// operators. Any nested ternaries present in the original must be replaced
// with if/else statements or extracted helper functions.
//
// Feature: code-simplifier, Property 15: No Nested Ternaries
// Validates: Requirements 4.3
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Generators for Property 15
// ---------------------------------------------------------------------------

/** Arbitrary for a simple value expression. */
const arbValue: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: 0, max: 999 }).map(String),
  arbIdentifier.map((name) => `'${name}'`),
  fc.constant('null'),
  fc.constant('undefined'),
);

/**
 * Generates a code section with a nested ternary assignment:
 *   const x = cond1 ? val1 : cond2 ? val2 : val3;
 * This is the pattern the no-nested-ternary rule detects and transforms.
 */
const arbNestedTernarySection: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbCondition, arbValue, arbCondition, arbValue, arbValue)
  .map(([varName, cond1, val1, cond2, val2, val3]) => {
    const content = `const ${varName} = ${cond1} ? ${val1} : ${cond2} ? ${val2} : ${val3};`;
    return makeSection(content);
  });

/**
 * Generates a code section with a nested ternary inside a function body.
 */
const arbNestedTernaryInFunction: fc.Arbitrary<CodeSection> = fc
  .tuple(arbIdentifier, arbIdentifier, arbCondition, arbValue, arbCondition, arbValue, arbValue)
  .map(([fnName, varName, cond1, val1, cond2, val2, val3]) => {
    const content = [
      `function ${fnName}() {`,
      `  const ${varName} = ${cond1} ? ${val1} : ${cond2} ? ${val2} : ${val3};`,
      `  return ${varName};`,
      `}`,
    ].join('\n');
    return makeSection(content);
  });

/** Combined generator for sections with nested ternaries. */
const arbTernarySection: fc.Arbitrary<CodeSection> = fc.oneof(
  arbNestedTernarySection,
  arbNestedTernaryInFunction,
);

/** Regex that detects two or more ? operators in the same expression (nested ternary). */
const TERNARY_IN_TERNARY = /\?[^?]*\?/;

// ---------------------------------------------------------------------------
// Property 15 tests
// ---------------------------------------------------------------------------

describe('Property 15: No Nested Ternaries', () => {
  it(
    'no nested ternary operators remain after transform',
    () => {
      fc.assert(
        fc.property(arbTernarySection, (section) => {
          const result = noNestedTernaryRule.transform(section);
          // The refined code should not contain nested ternaries
          // Check each line individually — a single ? is fine, but two ?'s
          // in the same expression indicates nesting
          const lines = result.refined.split('\n');
          for (const line of lines) {
            // Skip lines that are just if/else control flow
            if (/^\s*(if|else|} else)/.test(line)) continue;
            // No line should have two ? operators (nested ternary)
            const questionMarks = (line.match(/\?/g) || []).length;
            if (questionMarks >= 2) {
              // Double-check it's actually a nested ternary, not two separate ternaries
              expect(line).not.toMatch(TERNARY_IN_TERNARY);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects sections containing nested ternaries',
    () => {
      fc.assert(
        fc.property(arbTernarySection, (section) => {
          const violation = noNestedTernaryRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.clarity.no-nested-ternary');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transformed output uses if/else instead of nested ternaries',
    () => {
      fc.assert(
        fc.property(arbNestedTernarySection, (section) => {
          const result = noNestedTernaryRule.transform(section);
          // The refined code should contain if/else constructs
          expect(result.refined).toMatch(/\bif\s*\(/);
          expect(result.refined).toMatch(/\belse\b/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbTernarySection, (section) => {
          const result = noNestedTernaryRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.clarity.no-nested-ternary');
        }),
        { numRuns: 100 },
      );
    },
  );
});
