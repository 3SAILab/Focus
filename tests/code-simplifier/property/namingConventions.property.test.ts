/**
 * Property 23: TypeScript Naming Conventions
 *
 * For any TypeScript file after refinement, local variables, function parameters,
 * and non-exported functions must use camelCase, while React component names,
 * TypeScript interfaces, and type aliases must use PascalCase.
 *
 * Feature: code-simplifier, Property 23: TypeScript Naming Conventions
 * Validates: Requirements 9.1, 9.2
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tsNamingRules } from '../../../frontend/src/code-simplifier/rules/ts.naming';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

const camelCaseRule = tsNamingRules.find((r) => r.id === 'ts.naming.camelCase')!;
const pascalCaseRule = tsNamingRules.find((r) => r.id === 'ts.naming.PascalCase')!;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Arbitrary for a lowercase identifier (2-10 chars). */
const arbLowerIdent: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 10,
  })
  .filter((s) => s.length >= 2);

/** Arbitrary for a PascalCase name (starts uppercase). */
const arbPascalName: fc.Arbitrary<string> = arbLowerIdent.map(
  (s) => s.charAt(0).toUpperCase() + s.slice(1),
);

/** Generates a snake_case variable name. */
const arbSnakeCaseName: fc.Arbitrary<string> = fc
  .tuple(arbLowerIdent, arbLowerIdent)
  .map(([a, b]) => `${a}_${b}`);

/** Generates a PascalCase name used as a local variable (violation). */
const arbPascalLocalName: fc.Arbitrary<string> = arbPascalName;

/** Generates a non-camelCase local variable declaration. */
const arbNonCamelLocalDecl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('const', 'let', 'var'),
    fc.oneof(arbSnakeCaseName, arbPascalLocalName),
    fc.constantFrom('42', '"hello"', 'true', '[]'),
  )
  .map(([kw, name, value]) => `${kw} ${name} = ${value};`);

/** Generates a CodeSection with non-camelCase local variables. */
const arbNonCamelSection: fc.Arbitrary<CodeSection> = fc
  .array(arbNonCamelLocalDecl, { minLength: 1, maxLength: 4 })
  .map((decls) => {
    const content = decls.join('\n');
    return {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: decls.length,
      content,
    };
  });

/** Generates a non-PascalCase interface declaration. */
const arbNonPascalInterface: fc.Arbitrary<string> = fc
  .tuple(arbLowerIdent, arbLowerIdent)
  .map(([name, prop]) => `interface ${name} {\n  ${prop}: string;\n}`);

/** Generates a non-PascalCase type alias. */
const arbNonPascalType: fc.Arbitrary<string> = fc
  .tuple(arbLowerIdent)
  .map(([name]) => `type ${name} = string | number;`);

/** Generates a CodeSection with non-PascalCase interfaces/types. */
const arbNonPascalSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbNonPascalInterface, { minLength: 1, maxLength: 3 }),
    fc.array(arbNonPascalType, { minLength: 0, maxLength: 2 }),
  )
  .map(([interfaces, types]) => {
    const lines = [...interfaces, ...types];
    const content = lines.join('\n\n');
    return {
      filePath: 'src/types.ts',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
    };
  });

// ---------------------------------------------------------------------------
// Property 23: TypeScript Naming Conventions
// ---------------------------------------------------------------------------

describe('Property 23: TypeScript Naming Conventions', () => {
  it(
    'camelCase rule detects all non-camelCase local variables',
    () => {
      fc.assert(
        fc.property(arbNonCamelSection, (section) => {
          const violation = camelCaseRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.naming.camelCase');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'camelCase transform produces identifiers matching camelCase pattern',
    () => {
      fc.assert(
        fc.property(arbNonCamelSection, (section) => {
          const result = camelCaseRule.transform(section);
          // After transform, extract local variable names and verify they are camelCase
          const lines = result.refined.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            const varMatch = trimmed.match(/^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=/);
            if (varMatch) {
              const name = varMatch[1];
              // Should be camelCase or CONSTANT_CASE after transform
              const isCamel = /^[a-z][a-zA-Z0-9]*$/.test(name);
              const isConstant = /^[A-Z][A-Z0-9_]*$/.test(name);
              expect(isCamel || isConstant).toBe(true);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'camelCase transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbNonCamelSection, (section) => {
          const result = camelCaseRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.naming.camelCase');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'PascalCase rule detects all non-PascalCase interfaces and type aliases',
    () => {
      fc.assert(
        fc.property(arbNonPascalSection, (section) => {
          const violation = pascalCaseRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.naming.PascalCase');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'PascalCase transform produces identifiers matching PascalCase pattern',
    () => {
      fc.assert(
        fc.property(arbNonPascalSection, (section) => {
          const result = pascalCaseRule.transform(section);
          const lines = result.refined.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            // Check interface names
            const interfaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
            if (interfaceMatch) {
              const name = interfaceMatch[1];
              expect(name).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
            }
            // Check type alias names
            const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=<]/);
            if (typeMatch) {
              const name = typeMatch[1];
              expect(name).toMatch(/^[A-Z][a-zA-Z0-9]*$/);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'PascalCase transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbNonPascalSection, (section) => {
          const result = pascalCaseRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.naming.PascalCase');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 24: Descriptive Naming
//
// For any code section after refinement, there must be no single-letter
// variable names except in short lambda parameters and loop index variables
// (e.g., i, j).
//
// Feature: code-simplifier, Property 24: Descriptive Naming
// Validates: Requirements 9.4
// ---------------------------------------------------------------------------

const descriptiveRule = tsNamingRules.find((r) => r.id === 'ts.naming.descriptive')!;

// ---------------------------------------------------------------------------
// Generators for Property 24
// ---------------------------------------------------------------------------

/** Arbitrary for a single letter (not a loop index). */
const arbSingleLetter: fc.Arbitrary<string> = fc.constantFrom(
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
  'l', 'm', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z',
);

/** Generates a single-letter variable declaration (violation). */
const arbSingleLetterDecl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('const', 'let', 'var'),
    arbSingleLetter,
    fc.constantFrom('42', '"hello"', 'true', '[]', '{}'),
  )
  .map(([kw, name, value]) => `${kw} ${name} = ${value};`);

/** Generates a CodeSection with single-letter variable violations. */
const arbSingleLetterSection: fc.Arbitrary<CodeSection> = fc
  .array(arbSingleLetterDecl, { minLength: 1, maxLength: 4 })
  .map((decls) => {
    const content = decls.join('\n');
    return {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: decls.length,
      content,
    };
  });

/** Generates a for-loop with allowed loop index. */
const arbForLoopWithIndex: fc.Arbitrary<string> = fc
  .constantFrom('i', 'j', 'k', 'n')
  .map((idx) => `for (let ${idx} = 0; ${idx} < 10; ${idx}++) {\n  console.log(${idx});\n}`);

/** Generates a short lambda with single-letter param (allowed). */
const arbShortLambda: fc.Arbitrary<string> = fc
  .tuple(arbLowerIdent, arbSingleLetter)
  .map(([arr, param]) => `const result = ${arr}.map((${param}) => ${param}.id);`);

/** Generates a CodeSection with only allowed single-letter usages (no violations). */
const arbAllowedSingleLetterSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbForLoopWithIndex, { minLength: 1, maxLength: 2 }),
    fc.array(arbShortLambda, { minLength: 0, maxLength: 2 }),
  )
  .map(([loops, lambdas]) => {
    const lines = [...loops, ...lambdas];
    const content = lines.join('\n');
    return {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
    };
  });

// ---------------------------------------------------------------------------
// Property 24 tests
// ---------------------------------------------------------------------------

describe('Property 24: Descriptive Naming', () => {
  it(
    'descriptive rule detects single-letter variable declarations',
    () => {
      fc.assert(
        fc.property(arbSingleLetterSection, (section) => {
          const violation = descriptiveRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.naming.descriptive');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'descriptive rule does not flag allowed single-letter usages (loop indices, short lambdas)',
    () => {
      fc.assert(
        fc.property(arbAllowedSingleLetterSection, (section) => {
          const violation = descriptiveRule.match(section);
          expect(violation).toBeNull();
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'descriptive transform adds TODO comment listing the single-letter names',
    () => {
      fc.assert(
        fc.property(arbSingleLetterSection, (section) => {
          const result = descriptiveRule.transform(section);
          expect(result.refined).toContain('TODO');
          expect(result.refined).toContain('Rename single-letter');
          // Original code is preserved
          expect(result.refined).toContain(section.content);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'descriptive transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbSingleLetterSection, (section) => {
          const result = descriptiveRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.naming.descriptive');
        }),
        { numRuns: 100 },
      );
    },
  );
});
