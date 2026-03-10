/**
 * Property 1: Behavior Preservation Invariant
 *
 * For any code section and any refinement produced by the Code Simplifier,
 * either the refined code preserves all observable behavior (return values,
 * side effects, event emissions, error propagation) of the original, OR the
 * refinement is discarded (validator returns safe: false) and the original
 * code is left unchanged.
 *
 * Feature: code-simplifier, Property 1: Behavior Preservation Invariant
 * Validates: Requirements 1.1, 1.5
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DefaultBehaviorPreservationValidator } from '../../../frontend/src/code-simplifier/validators/behaviorValidator';
import {
  extractFunctionSignatures,
  extractErrorHandlingPatterns,
  extractSideEffects,
  countFunctions,
  extractIntermediateVariables,
  countMaxNesting,
  hasComplexFunctionalChains,
  evaluateBalanceChecks,
} from '../../../frontend/src/code-simplifier/validators/behaviorValidator';
import type {
  Transformation,
  CodeSection,
} from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Validator instance
// ---------------------------------------------------------------------------

const validator = new DefaultBehaviorPreservationValidator();

// ---------------------------------------------------------------------------
// Code snippet building blocks for generators
// ---------------------------------------------------------------------------

const TS_FUNCTION_TEMPLATES = [
  (name: string) => `export function ${name}(a: string, b: number): string {\n  return a + b;\n}`,
  (name: string) => `function ${name}(x: number): number {\n  return x * 2;\n}`,
  (name: string) => `export async function ${name}(id: string): Promise<void> {\n  console.log(id);\n}`,
];

const ERROR_HANDLING_TEMPLATES = [
  `try {\n  doSomething();\n} catch (err) {\n  throw err;\n}`,
  `try {\n  await fetchData();\n} catch (error) {\n  console.error(error);\n  throw error;\n}`,
];

const SIDE_EFFECT_TEMPLATES = [
  'console.log("starting");',
  'setState({ loading: true });',
  'dispatch({ type: "LOAD" });',
  'emit("data", result);',
  'console.log("done");',
  'localStorage.setItem("key", value);',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a CodeSection from a code string. */
function makeContext(code: string, filePath = 'src/test.ts'): CodeSection {
  return {
    filePath,
    startLine: 1,
    endLine: code.split('\n').length,
    content: code,
  };
}

/** Build a Transformation from original and refined code strings. */
function makeTransformation(
  original: string,
  refined: string,
  filePath = 'src/test.ts',
): Transformation {
  return {
    ruleId: 'test.rule',
    filePath,
    original,
    refined,
    startLine: 1,
    endLine: Math.max(original.split('\n').length, refined.split('\n').length),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries — smart generators that produce realistic code snippets
// ---------------------------------------------------------------------------

/** Arbitrary for a valid camelCase identifier. */
const arbIdentifier: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 3,
    maxLength: 12,
  })
  .map((s) => s.charAt(0).toLowerCase() + s.slice(1));

/** Arbitrary that picks a function template and generates a named function. */
const arbTsFunction: fc.Arbitrary<string> = fc
  .tuple(
    arbIdentifier,
    fc.constantFrom(...TS_FUNCTION_TEMPLATES),
  )
  .map(([name, template]) => template(name));

/** Arbitrary for a block of side-effect statements (ordered subset). */
const arbSideEffects: fc.Arbitrary<string[]> = fc.subarray(SIDE_EFFECT_TEMPLATES, {
  minLength: 1,
  maxLength: SIDE_EFFECT_TEMPLATES.length,
});

/** Arbitrary for an error handling block. */
const arbErrorBlock: fc.Arbitrary<string> = fc.constantFrom(...ERROR_HANDLING_TEMPLATES);

/**
 * Arbitrary that produces a realistic code snippet containing functions,
 * side effects, and error handling.
 */
const arbCodeSnippet: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(arbTsFunction, { minLength: 1, maxLength: 3 }),
    arbSideEffects,
    arbErrorBlock,
  )
  .map(([functions, effects, errorBlock]) => {
    const parts = [...functions, errorBlock];
    // Wrap side effects in a function body
    const effectBody = `function run(): void {\n  ${effects.join('\n  ')}\n}`;
    parts.push(effectBody);
    return parts.join('\n\n');
  });

/**
 * Arbitrary that produces a behavior-preserving refinement: the refined code
 * keeps all signatures, error handling, side effects, and code paths intact
 * but may add whitespace, comments, or reformat.
 */
const arbPreservingRefinement: fc.Arbitrary<{ original: string; refined: string }> = arbCodeSnippet.chain(
  (code) =>
    fc
      .constantFrom(
        // Add a comment
        (c: string) => `// Refactored for clarity\n${c}`,
        // Add trailing newline
        (c: string) => `${c}\n`,
        // Identity (no change)
        (c: string) => c,
        // Add blank lines between sections
        (c: string) => c.replace(/\n\n/g, '\n\n\n'),
      )
      .map((transform) => ({
        original: code,
        refined: transform(code),
      })),
);

// ---------------------------------------------------------------------------
// Mutation helpers — produce behavior-breaking refinements
// ---------------------------------------------------------------------------

/** Remove a function signature from code by changing the function name. */
function mutateSignature(code: string): string {
  // Change the first function name to break the signature
  return code.replace(
    /((?:export\s+)?(?:async\s+)?function\s+)(\w+)/,
    '$1__removed__$2',
  );
}

/** Remove error handling from code — remove catch blocks entirely. */
function removeErrorHandling(code: string): string {
  // Remove catch clauses so the pattern count drops
  return code.replace(/catch\s*\([^)]*\)\s*\{[^}]*\}/g, '{ }');
}

/** Reorder side effects in code. */
function reorderSideEffects(code: string): string {
  const lines = code.split('\n');
  const effectIndices: number[] = [];
  const effectLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      /console\.\w+\s*\(/.test(trimmed) ||
      /setState\s*\(/.test(trimmed) ||
      /dispatch\s*\(/.test(trimmed) ||
      /emit\s*\(/.test(trimmed) ||
      /localStorage\.\w+\s*\(/.test(trimmed)
    ) {
      effectIndices.push(i);
      effectLines.push(lines[i]);
    }
  }

  if (effectLines.length < 2) return code;

  // Reverse the side effects
  const reversed = [...effectLines].reverse();
  const result = [...lines];
  for (let i = 0; i < effectIndices.length; i++) {
    result[effectIndices[i]] = reversed[i];
  }
  return result.join('\n');
}

/** Remove conditional branches to reduce code paths. */
function removeCodePaths(code: string): string {
  // Remove if/else blocks to reduce branch count
  return code.replace(/if\s*\([^)]*\)\s*\{[^}]*\}/g, '');
}

/**
 * Arbitrary that produces a behavior-breaking refinement by applying one of
 * the mutation helpers to a code snippet.
 */
const arbBreakingRefinement: fc.Arbitrary<{
  original: string;
  refined: string;
  mutation: string;
}> = arbCodeSnippet.chain((code) =>
  fc
    .constantFrom(
      { fn: mutateSignature, name: 'mutateSignature' },
      { fn: removeErrorHandling, name: 'removeErrorHandling' },
      { fn: reorderSideEffects, name: 'reorderSideEffects' },
    )
    .map(({ fn, name }) => ({
      original: code,
      refined: fn(code),
      mutation: name,
    })),
);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 1: Behavior Preservation Invariant', () => {
  it(
    'if validator returns safe=true, then signatures, error handling, side effects, and code paths are preserved',
    () => {
      fc.assert(
        fc.property(arbCodeSnippet, fc.string({ minLength: 0, maxLength: 500 }), (original, refined) => {
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          if (result.safe) {
            // If the validator says safe, all observable behaviors must be preserved

            // 1. Function signatures preserved
            const origSigs = extractFunctionSignatures(original);
            const refSigs = extractFunctionSignatures(refined);
            for (const sig of origSigs) {
              expect(refSigs).toContain(sig);
            }

            // 2. Error handling patterns preserved
            const origErrors = extractErrorHandlingPatterns(original);
            const refErrors = extractErrorHandlingPatterns(refined);
            for (const pattern of origErrors) {
              expect(refErrors).toContain(pattern);
            }

            // 3. Side effects preserved in order
            const origEffects = extractSideEffects(original);
            const refEffects = extractSideEffects(refined);
            let refIdx = 0;
            for (const effect of origEffects) {
              let found = false;
              while (refIdx < refEffects.length) {
                if (refEffects[refIdx] === effect) {
                  found = true;
                  refIdx++;
                  break;
                }
                refIdx++;
              }
              expect(found).toBe(true);
            }

            // 4. Code paths preserved (return count, branch count)
            const origReturns = (original.match(/\breturn\b/g) ?? []).length;
            const refReturns = (refined.match(/\breturn\b/g) ?? []).length;
            expect(refReturns).toBeGreaterThanOrEqual(origReturns);

            const origBranches = (original.match(/\b(?:if|else|switch|case)\b/g) ?? []).length;
            const refBranches = (refined.match(/\b(?:if|else|switch|case)\b/g) ?? []).length;
            expect(refBranches).toBeGreaterThanOrEqual(origBranches);

            // 5. Balance checks pass
            const balance = evaluateBalanceChecks(original, refined);
            expect(balance.preservesAbstractions).toBe(true);
            expect(balance.noUnrelatedCombining).toBe(true);
            expect(balance.noComplexFunctionalChains).toBe(true);
            expect(balance.preservesIntermediateVars).toBe(true);
            expect(balance.readabilityNotReduced).toBe(true);
          }
          // If safe=false, the invariant holds trivially — refinement is discarded
        }),
        { numRuns: 150 },
      );
    },
  );

  it(
    'behavior-preserving refinements are accepted as safe',
    () => {
      fc.assert(
        fc.property(arbPreservingRefinement, ({ original, refined }) => {
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          // Preserving refinements should be accepted
          expect(result.safe).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'behavior-breaking refinements are rejected as unsafe',
    () => {
      fc.assert(
        fc.property(arbBreakingRefinement, ({ original, refined, mutation }) => {
          // Skip cases where the mutation didn't actually change anything
          if (original === refined) return;

          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          // The validator must detect the behavior change and reject it
          expect(result.safe).toBe(false);
          expect(result.reason).toBeDefined();
          expect(typeof result.reason).toBe('string');
          expect(result.reason!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'identical original and refined code is always safe',
    () => {
      fc.assert(
        fc.property(arbCodeSnippet, (code) => {
          const transformation = makeTransformation(code, code);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 2: Structural Preservation
//
// For any code section with exported functions or error handling paths, after
// refinement, if the validator says safe=true, then the set of public API
// signatures (function names, parameter types, return types) and the set of
// error handling paths and messages must be identical to the original.
// Also, when structural elements change, the validator must reject.
//
// Feature: code-simplifier, Property 2: Structural Preservation
// Validates: Requirements 1.2, 1.3
// ---------------------------------------------------------------------------

describe('Property 2: Structural Preservation', () => {
  // -----------------------------------------------------------------------
  // Generators specific to structural preservation
  // -----------------------------------------------------------------------

  /** Arbitrary for exported function snippets with varied signatures. */
  const arbExportedFunction: fc.Arbitrary<string> = fc
    .tuple(
      arbIdentifier,
      fc.constantFrom(
        (n: string) => `export function ${n}(a: string, b: number): string {\n  return a + String(b);\n}`,
        (n: string) => `export function ${n}(items: string[]): number {\n  return items.length;\n}`,
        (n: string) => `export async function ${n}(id: string): Promise<boolean> {\n  return id.length > 0;\n}`,
        (n: string) => `export function ${n}(x: number, y: number): number {\n  return x + y;\n}`,
      ),
    )
    .map(([name, template]) => template(name));

  /** Arbitrary for error handling blocks with varied patterns. */
  const arbErrorHandling: fc.Arbitrary<string> = fc.constantFrom(
    `try {\n  doSomething();\n} catch (err) {\n  throw err;\n}`,
    `try {\n  await fetchData();\n} catch (error) {\n  console.error(error);\n  throw error;\n}`,
    `try {\n  parse(input);\n} catch (e) {\n  throw e;\n}`,
    `try {\n  connect();\n} catch (err) {\n  throw err;\n}\nfetch("url").catch(\n  (e) => console.error(e)\n);`,
  );

  /** Arbitrary for code with exported functions AND error handling. */
  const arbStructuralCode: fc.Arbitrary<string> = fc
    .tuple(
      fc.array(arbExportedFunction, { minLength: 1, maxLength: 3 }),
      arbErrorHandling,
    )
    .map(([fns, errBlock]) => [...fns, errBlock].join('\n\n'));

  /**
   * Arbitrary that produces a structurally-preserving refinement:
   * keeps all signatures and error handling intact, only adds
   * whitespace / comments / formatting.
   */
  const arbStructuralPreservingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
  }> = arbStructuralCode.chain((code) =>
    fc
      .constantFrom(
        (c: string) => c, // identity
        (c: string) => `// Cleaned up\n${c}`, // prepend comment
        (c: string) => `${c}\n`, // trailing newline
        (c: string) => c.replace(/\n\n/g, '\n\n\n'), // extra blank lines
      )
      .map((transform) => ({
        original: code,
        refined: transform(code),
      })),
  );

  // -----------------------------------------------------------------------
  // Mutation helpers for structural changes
  // -----------------------------------------------------------------------

  /** Rename an exported function to break its signature. */
  function renameExportedFunction(code: string): string {
    return code.replace(
      /(export\s+(?:async\s+)?function\s+)(\w+)/,
      '$1__renamed__$2',
    );
  }

  /** Change parameter types of an exported function. */
  function changeParamTypes(code: string): string {
    return code.replace(
      /(export\s+(?:async\s+)?function\s+\w+\s*)\([^)]*\)/,
      '$1(z: boolean)',
    );
  }

  /** Change return type of an exported function. */
  function changeReturnType(code: string): string {
    return code.replace(
      /(export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*:\s*)\S+/,
      '$1void',
    );
  }

  /** Remove a catch block to break error handling paths. */
  function removeCatchBlock(code: string): string {
    return code.replace(/catch\s*\([^)]*\)\s*\{[^}]*\}/g, '{ }');
  }

  /** Remove throw statements to break error propagation. */
  function removeThrows(code: string): string {
    // Replace throw statements with a plain return to fully remove the throw pattern
    return code.replace(/throw\s+\w+;/g, 'return;');
  }

  /** Arbitrary that produces a structural-breaking refinement. */
  const arbStructuralBreakingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
    mutation: string;
  }> = arbStructuralCode.chain((code) =>
    fc
      .constantFrom(
        { fn: renameExportedFunction, name: 'renameExportedFunction' },
        { fn: changeParamTypes, name: 'changeParamTypes' },
        { fn: changeReturnType, name: 'changeReturnType' },
        { fn: removeCatchBlock, name: 'removeCatchBlock' },
        { fn: removeThrows, name: 'removeThrows' },
      )
      .map(({ fn, name }) => ({
        original: code,
        refined: fn(code),
        mutation: name,
      })),
  );

  // -----------------------------------------------------------------------
  // Property tests
  // -----------------------------------------------------------------------

  it(
    'if validator returns safe=true, public API signatures are identical to the original',
    () => {
      /**
       * Validates: Requirements 1.2
       *
       * For any code with exported functions, when the validator accepts a
       * refinement, the extracted function signatures must be identical.
       */
      fc.assert(
        fc.property(arbStructuralCode, fc.constantFrom(
          (c: string) => c,
          (c: string) => `// refactored\n${c}`,
          (c: string) => `${c}\n`,
          (c: string) => c.replace(/\n\n/g, '\n\n\n'),
        ), (original, transform) => {
          const refined = transform(original);
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          if (result.safe) {
            const origSigs = extractFunctionSignatures(original);
            const refSigs = extractFunctionSignatures(refined);

            // Same count
            expect(refSigs.length).toBe(origSigs.length);

            // Every original signature present in refined
            for (const sig of origSigs) {
              expect(refSigs).toContain(sig);
            }

            // Every refined signature present in original (no new ones added that break API)
            for (const sig of refSigs) {
              expect(origSigs).toContain(sig);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'if validator returns safe=true, error handling paths are identical to the original',
    () => {
      /**
       * Validates: Requirements 1.3
       *
       * For any code with error handling, when the validator accepts a
       * refinement, the extracted error handling patterns must be identical.
       */
      fc.assert(
        fc.property(arbStructuralCode, fc.constantFrom(
          (c: string) => c,
          (c: string) => `// refactored\n${c}`,
          (c: string) => `${c}\n`,
          (c: string) => c.replace(/\n\n/g, '\n\n\n'),
        ), (original, transform) => {
          const refined = transform(original);
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          if (result.safe) {
            const origErrors = extractErrorHandlingPatterns(original);
            const refErrors = extractErrorHandlingPatterns(refined);

            // Same count
            expect(refErrors.length).toBe(origErrors.length);

            // Every original error pattern present in refined
            for (const pattern of origErrors) {
              expect(refErrors).toContain(pattern);
            }

            // Every refined error pattern present in original
            for (const pattern of refErrors) {
              expect(origErrors).toContain(pattern);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'structurally-preserving refinements are accepted as safe',
    () => {
      /**
       * Validates: Requirements 1.2, 1.3
       *
       * Refinements that keep all signatures and error handling intact
       * should be accepted by the validator.
       */
      fc.assert(
        fc.property(arbStructuralPreservingRefinement, ({ original, refined }) => {
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'when function signatures change, the validator rejects the refinement',
    () => {
      /**
       * Validates: Requirements 1.2
       *
       * Renaming, changing params, or changing return types of exported
       * functions must cause the validator to return safe=false.
       */
      fc.assert(
        fc.property(
          arbStructuralCode,
          fc.constantFrom(
            { fn: renameExportedFunction, name: 'renameExportedFunction' },
            { fn: changeParamTypes, name: 'changeParamTypes' },
            { fn: changeReturnType, name: 'changeReturnType' },
          ),
          (original, { fn }) => {
            const refined = fn(original);
            if (original === refined) return; // mutation didn't apply

            const transformation = makeTransformation(original, refined);
            const context = makeContext(original);
            const result = validator.validate(transformation, context);

            expect(result.safe).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'when error handling paths change, the validator rejects the refinement',
    () => {
      /**
       * Validates: Requirements 1.3
       *
       * Removing catch blocks or throw statements must cause the validator
       * to return safe=false.
       */
      fc.assert(
        fc.property(
          arbStructuralCode,
          fc.constantFrom(
            { fn: removeCatchBlock, name: 'removeCatchBlock' },
            { fn: removeThrows, name: 'removeThrows' },
          ),
          (original, { fn }) => {
            const refined = fn(original);
            if (original === refined) return; // mutation didn't apply

            const transformation = makeTransformation(original, refined);
            const context = makeContext(original);
            const result = validator.validate(transformation, context);

            expect(result.safe).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'identical code is always structurally safe',
    () => {
      /**
       * Validates: Requirements 1.2, 1.3
       *
       * When original and refined are the same, structural preservation
       * trivially holds.
       */
      fc.assert(
        fc.property(arbStructuralCode, (code) => {
          const transformation = makeTransformation(code, code);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);

          // Verify signatures and error patterns are identical
          const sigs = extractFunctionSignatures(code);
          const errors = extractErrorHandlingPatterns(code);
          expect(sigs.length).toBeGreaterThan(0);
          expect(errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 3: Side-Effect Order Preservation
//
// For any code section containing side-effect-producing statements, after
// refinement, if the validator says safe=true, the relative ordering of those
// statements must be identical to the original. When side effects are
// reordered or removed, the validator must reject.
//
// Feature: code-simplifier, Property 3: Side-Effect Order Preservation
// Validates: Requirements 1.4
// ---------------------------------------------------------------------------

describe('Property 3: Side-Effect Order Preservation', () => {
  // -----------------------------------------------------------------------
  // Side-effect statement pool — each matches SIDE_EFFECT_PATTERNS
  // -----------------------------------------------------------------------

  const EFFECT_POOL = [
    'console.log("step1");',
    'console.warn("warning");',
    'console.error("err");',
    'setState({ loading: true });',
    'dispatch({ type: "INIT" });',
    'emit("start", data);',
    'localStorage.setItem("k", "v");',
    'sessionStorage.setItem("s", "v");',
    'document.getElementById("x");',
    'window.scrollTo(0, 0);',
    'fs.writeFileSync("f", "d");',
    'http.get("/api");',
  ];

  /**
   * Arbitrary that produces a unique ordered subset of side-effect statements
   * (at least 2 so reordering is meaningful).
   */
  const arbEffectList: fc.Arbitrary<string[]> = fc
    .shuffledSubarray(EFFECT_POOL, { minLength: 2, maxLength: EFFECT_POOL.length })
    // shuffledSubarray already gives a random permutation of the chosen subset,
    // but we want a *specific* ordering, so we just use it as-is.
    ;

  /**
   * Wrap a list of side-effect statements inside a function body to form
   * a realistic code section.
   */
  function wrapInFunction(effects: string[], fnName = 'execute'): string {
    const body = effects.map((e) => `  ${e}`).join('\n');
    return `function ${fnName}(): void {\n${body}\n}`;
  }

  /**
   * Arbitrary for a code section that contains side-effect statements
   * wrapped in a function, optionally with an exported function to keep
   * the validator's other checks happy.
   */
  const arbSideEffectCode: fc.Arbitrary<{ code: string; effects: string[] }> =
    fc.tuple(arbEffectList, arbIdentifier).map(([effects, name]) => ({
      code: wrapInFunction(effects, name),
      effects,
    }));

  /**
   * Arbitrary that produces a side-effect-preserving refinement: keeps all
   * effects in the same order, only adds whitespace / comments / formatting.
   */
  const arbOrderPreservingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
    effects: string[];
  }> = arbSideEffectCode.chain(({ code, effects }) =>
    fc
      .constantFrom(
        (c: string) => c, // identity
        (c: string) => `// Refactored\n${c}`, // prepend comment
        (c: string) => `${c}\n`, // trailing newline
      )
      .map((transform) => ({
        original: code,
        refined: transform(code),
        effects,
      })),
  );

  // -----------------------------------------------------------------------
  // Mutation helpers for side-effect order
  // -----------------------------------------------------------------------

  /** Reverse the order of side-effect lines in the code. */
  function reverseSideEffects(code: string, effects: string[]): string {
    if (effects.length < 2) return code;
    let result = code;
    const reversed = [...effects].reverse();
    // Replace each effect with a placeholder, then fill in reversed
    const placeholders = effects.map((_, i) => `__PLACEHOLDER_${i}__`);
    for (let i = 0; i < effects.length; i++) {
      result = result.replace(effects[i], placeholders[i]);
    }
    for (let i = 0; i < placeholders.length; i++) {
      result = result.replace(placeholders[i], reversed[i]);
    }
    return result;
  }

  /** Swap the first two side-effect lines. */
  function swapFirstTwo(code: string, effects: string[]): string {
    if (effects.length < 2) return code;
    let result = code;
    const p0 = '__SWAP_0__';
    const p1 = '__SWAP_1__';
    result = result.replace(effects[0], p0);
    result = result.replace(effects[1], p1);
    result = result.replace(p0, effects[1]);
    result = result.replace(p1, effects[0]);
    return result;
  }

  /** Remove the first side-effect statement. */
  function removeFirstEffect(code: string, effects: string[]): string {
    if (effects.length < 1) return code;
    // Remove the line containing the first effect
    return code
      .split('\n')
      .filter((line) => !line.includes(effects[0]))
      .join('\n');
  }

  /** Remove the last side-effect statement. */
  function removeLastEffect(code: string, effects: string[]): string {
    if (effects.length < 1) return code;
    const last = effects[effects.length - 1];
    return code
      .split('\n')
      .filter((line) => !line.includes(last))
      .join('\n');
  }

  /** Arbitrary that produces a side-effect-breaking refinement. */
  const arbOrderBreakingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
    effects: string[];
    mutation: string;
  }> = arbSideEffectCode.chain(({ code, effects }) =>
    fc
      .constantFrom(
        { fn: (c: string) => reverseSideEffects(c, effects), name: 'reverse' },
        { fn: (c: string) => swapFirstTwo(c, effects), name: 'swapFirstTwo' },
        { fn: (c: string) => removeFirstEffect(c, effects), name: 'removeFirst' },
        { fn: (c: string) => removeLastEffect(c, effects), name: 'removeLast' },
      )
      .map(({ fn, name }) => ({
        original: code,
        refined: fn(code),
        effects,
        mutation: name,
      })),
  );

  // -----------------------------------------------------------------------
  // Property tests
  // -----------------------------------------------------------------------

  it(
    'if validator returns safe=true, side-effect order is identical to the original',
    () => {
      /**
       * Validates: Requirements 1.4
       *
       * For any code with side effects, when the validator accepts a
       * refinement, extractSideEffects on original and refined must
       * yield the same ordered list.
       */
      fc.assert(
        fc.property(arbSideEffectCode, fc.constantFrom(
          (c: string) => c,
          (c: string) => `// cleaned\n${c}`,
          (c: string) => `${c}\n`,
        ), ({ code, effects }, transform) => {
          const refined = transform(code);
          const transformation = makeTransformation(code, refined);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          if (result.safe) {
            const origEffects = extractSideEffects(code);
            const refEffects = extractSideEffects(refined);

            // The relative order must be identical
            expect(refEffects.length).toBeGreaterThanOrEqual(origEffects.length);

            // Verify the original effects appear as a subsequence in the same order
            let refIdx = 0;
            for (const effect of origEffects) {
              let found = false;
              while (refIdx < refEffects.length) {
                if (refEffects[refIdx] === effect) {
                  found = true;
                  refIdx++;
                  break;
                }
                refIdx++;
              }
              expect(found).toBe(true);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'order-preserving refinements are accepted as safe',
    () => {
      /**
       * Validates: Requirements 1.4
       *
       * Refinements that keep all side effects in the same order
       * (only adding whitespace/comments) should be accepted.
       */
      fc.assert(
        fc.property(arbOrderPreservingRefinement, ({ original, refined, effects }) => {
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);

          // Double-check: extracted effects from both should preserve order
          const origEffects = extractSideEffects(original);
          const refEffects = extractSideEffects(refined);
          expect(origEffects.length).toBe(effects.length);
          expect(refEffects.length).toBe(effects.length);
          for (let i = 0; i < origEffects.length; i++) {
            expect(refEffects[i]).toBe(origEffects[i]);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'when side effects are reordered, the validator rejects the refinement',
    () => {
      /**
       * Validates: Requirements 1.4
       *
       * Reversing or swapping side-effect statements must cause the
       * validator to return safe=false.
       */
      fc.assert(
        fc.property(
          arbSideEffectCode,
          fc.constantFrom(
            { fn: (c: string, e: string[]) => reverseSideEffects(c, e), name: 'reverse' },
            { fn: (c: string, e: string[]) => swapFirstTwo(c, e), name: 'swapFirstTwo' },
          ),
          ({ code, effects }, { fn }) => {
            const refined = fn(code, effects);
            if (code === refined) return; // mutation didn't change anything

            const transformation = makeTransformation(code, refined);
            const context = makeContext(code);
            const result = validator.validate(transformation, context);

            expect(result.safe).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'when side effects are removed, the validator rejects the refinement',
    () => {
      /**
       * Validates: Requirements 1.4
       *
       * Removing any side-effect statement must cause the validator
       * to return safe=false.
       */
      fc.assert(
        fc.property(
          arbSideEffectCode,
          fc.constantFrom(
            { fn: (c: string, e: string[]) => removeFirstEffect(c, e), name: 'removeFirst' },
            { fn: (c: string, e: string[]) => removeLastEffect(c, e), name: 'removeLast' },
          ),
          ({ code, effects }, { fn }) => {
            const refined = fn(code, effects);
            if (code === refined) return; // mutation didn't change anything

            const transformation = makeTransformation(code, refined);
            const context = makeContext(code);
            const result = validator.validate(transformation, context);

            expect(result.safe).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason!.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'identical code always preserves side-effect order',
    () => {
      /**
       * Validates: Requirements 1.4
       *
       * When original and refined are the same, side-effect order
       * trivially holds.
       */
      fc.assert(
        fc.property(arbSideEffectCode, ({ code, effects }) => {
          const transformation = makeTransformation(code, code);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);

          // Verify side effects are detected
          const extracted = extractSideEffects(code);
          expect(extracted.length).toBe(effects.length);
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 16: Abstraction Preservation
//
// For any code section after refinement, the number of distinct functions and
// modules must be greater than or equal to the original count — no existing
// abstractions that separate concerns may be inlined or removed. If the
// validator says safe=true, then countFunctions(refined) >= countFunctions(original).
//
// Feature: code-simplifier, Property 16: Abstraction Preservation
// Validates: Requirements 5.1
// ---------------------------------------------------------------------------

describe('Property 16: Abstraction Preservation', () => {
  // -----------------------------------------------------------------------
  // Generators for multi-function code snippets
  // -----------------------------------------------------------------------

  /** Arbitrary for code containing multiple distinct functions. */
  const arbMultiFunctionCode: fc.Arbitrary<string> = fc
    .array(arbTsFunction, { minLength: 2, maxLength: 5 })
    .map((fns) => fns.join('\n\n'));

  /**
   * Arbitrary that produces an abstraction-preserving refinement:
   * keeps all functions intact, only adds whitespace / comments / formatting.
   */
  const arbAbstractionPreservingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
  }> = arbMultiFunctionCode.chain((code) =>
    fc
      .constantFrom(
        (c: string) => c, // identity
        (c: string) => `// Cleaned up\n${c}`, // prepend comment
        (c: string) => `${c}\n`, // trailing newline
        (c: string) => c.replace(/\n\n/g, '\n\n\n'), // extra blank lines
      )
      .map((transform) => ({
        original: code,
        refined: transform(code),
      })),
  );

  /**
   * Arbitrary that produces a refinement adding new functions (count increases).
   */
  const arbAddFunctionRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
  }> = fc
    .tuple(arbMultiFunctionCode, arbTsFunction)
    .map(([code, extraFn]) => ({
      original: code,
      refined: `${code}\n\n${extraFn}`,
    }));

  // -----------------------------------------------------------------------
  // Mutation helpers — inline / remove functions to reduce count
  // -----------------------------------------------------------------------

  /** Remove the first function declaration entirely. */
  function removeFirstFunction(code: string): string {
    // Remove the first complete function block (function ... { ... })
    return code.replace(
      /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+?)?\s*\{[^}]*\}/,
      '',
    );
  }

  /** Inline two functions into one by removing the second and merging its body. */
  function inlineFunctions(code: string): string {
    // Find all function blocks
    const fnPattern = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+?)?\s*\{[^}]*\}/g;
    const matches = [...code.matchAll(fnPattern)];
    if (matches.length < 2) return code;

    // Remove the second function entirely (simulating inlining into the first)
    const secondMatch = matches[1];
    return code.slice(0, secondMatch.index!) + code.slice(secondMatch.index! + secondMatch[0].length);
  }

  /** Arbitrary that produces an abstraction-breaking refinement (fewer functions). */
  const arbAbstractionBreakingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
    mutation: string;
  }> = arbMultiFunctionCode.chain((code) =>
    fc
      .constantFrom(
        { fn: removeFirstFunction, name: 'removeFirstFunction' },
        { fn: inlineFunctions, name: 'inlineFunctions' },
      )
      .map(({ fn, name }) => ({
        original: code,
        refined: fn(code),
        mutation: name,
      })),
  );

  // -----------------------------------------------------------------------
  // Property tests
  // -----------------------------------------------------------------------

  it(
    'if validator returns safe=true, function count is preserved or increased',
    () => {
      /**
       * Validates: Requirements 5.1
       *
       * For any code with multiple functions, when the validator accepts a
       * refinement, countFunctions(refined) >= countFunctions(original).
       */
      fc.assert(
        fc.property(arbMultiFunctionCode, fc.string({ minLength: 0, maxLength: 800 }), (original, refined) => {
          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          if (result.safe) {
            const origCount = countFunctions(original);
            const refCount = countFunctions(refined);
            expect(refCount).toBeGreaterThanOrEqual(origCount);
          }
        }),
        { numRuns: 150 },
      );
    },
  );

  it(
    'when functions are removed or inlined, validator rejects',
    () => {
      /**
       * Validates: Requirements 5.1
       *
       * Removing or inlining functions reduces the abstraction count,
       * so the validator must return safe=false.
       */
      fc.assert(
        fc.property(arbAbstractionBreakingRefinement, ({ original, refined, mutation }) => {
          if (original === refined) return; // mutation didn't apply

          const origCount = countFunctions(original);
          const refCount = countFunctions(refined);
          // Only assert rejection when function count actually decreased
          if (refCount >= origCount) return;

          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'adding new functions is accepted (count increases)',
    () => {
      /**
       * Validates: Requirements 5.1
       *
       * Adding functions increases the abstraction count, which should
       * be accepted by the validator (preservesAbstractions = true).
       */
      fc.assert(
        fc.property(arbAddFunctionRefinement, ({ original, refined }) => {
          const origCount = countFunctions(original);
          const refCount = countFunctions(refined);

          // Confirm the generator actually added a function
          expect(refCount).toBeGreaterThanOrEqual(origCount);

          // evaluateBalanceChecks should report preservesAbstractions = true
          const balance = evaluateBalanceChecks(original, refined);
          expect(balance.preservesAbstractions).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'identical code always preserves abstractions',
    () => {
      /**
       * Validates: Requirements 5.1
       *
       * When original and refined are the same, abstraction preservation
       * trivially holds.
       */
      fc.assert(
        fc.property(arbMultiFunctionCode, (code) => {
          const transformation = makeTransformation(code, code);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);

          const fnCount = countFunctions(code);
          expect(fnCount).toBeGreaterThanOrEqual(2);

          const balance = evaluateBalanceChecks(code, code);
          expect(balance.preservesAbstractions).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Property 17: Intermediate Variable Preservation
//
// For any code section containing named intermediate variables that clarify
// computation intent, those variables must still be present after refinement
// (not inlined into larger expressions). If the validator says safe=true,
// then every variable from extractIntermediateVariables(original) must also
// appear in extractIntermediateVariables(refined).
//
// Feature: code-simplifier, Property 17: Intermediate Variable Preservation
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe('Property 17: Intermediate Variable Preservation', () => {
  // -----------------------------------------------------------------------
  // Generators for code with intermediate variables
  // -----------------------------------------------------------------------

  /** Templates that produce intermediate variable assignments. */
  const INTERMEDIATE_VAR_TEMPLATES: Array<(name: string) => string> = [
    (n) => `const ${n} = price + tax;`,
    (n) => `const ${n} = \`$\${total}\`;`,
    (n) => `const ${n} = total * 0.1;`,
    (n) => `let ${n} = items.length;`,
    (n) => `const ${n} = a + b + c;`,
    (n) => `const ${n} = Math.max(x, y);`,
    (n) => `let ${n} = data.filter(Boolean);`,
    (n) => `const ${n} = JSON.stringify(obj);`,
    (n) => `var ${n} = count + offset;`,
    (n) => `const ${n} = width * height;`,
  ];

  /**
   * Arbitrary that produces a code block containing 2–5 intermediate
   * variable assignments wrapped inside a function body.
   */
  const arbIntermediateVarCode: fc.Arbitrary<string> = fc
    .tuple(
      arbIdentifier,
      fc.uniqueArray(arbIdentifier, { minLength: 2, maxLength: 5 }),
    )
    .chain(([fnName, varNames]) =>
      fc
        .tuple(
          ...varNames.map((name) =>
            fc.constantFrom(...INTERMEDIATE_VAR_TEMPLATES).map((tpl) => tpl(name)),
          ),
        )
        .map((assignments) => {
          const body = assignments.map((a) => `  ${a}`).join('\n');
          return `function ${fnName}(): void {\n${body}\n  return;\n}`;
        }),
    );

  /**
   * Arbitrary that produces a preserving refinement: keeps all intermediate
   * variables intact, only adds whitespace / comments / formatting.
   */
  const arbVarPreservingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
  }> = arbIntermediateVarCode.chain((code) =>
    fc
      .constantFrom(
        (c: string) => c, // identity
        (c: string) => `// Cleaned up\n${c}`, // prepend comment
        (c: string) => `${c}\n`, // trailing newline
        (c: string) => c.replace(/\n/g, '\n\n'), // extra blank lines
      )
      .map((transform) => ({
        original: code,
        refined: transform(code),
      })),
  );

  /**
   * Arbitrary that produces a refinement adding new intermediate variables
   * (all originals still present, plus extras).
   */
  const arbAddVarRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
  }> = fc
    .tuple(arbIntermediateVarCode, arbIdentifier)
    .filter(([, extraName]) => extraName.length >= 3)
    .map(([code, extraName]) => ({
      original: code,
      refined: code.replace(
        '  return;',
        `  const ${extraName}Extra = 42;\n  return;`,
      ),
    }));

  // -----------------------------------------------------------------------
  // Mutation helpers — inline / remove intermediate variables
  // -----------------------------------------------------------------------

  /**
   * Remove the first intermediate variable assignment from the code,
   * simulating inlining it into a larger expression.
   */
  function removeFirstIntermediateVar(code: string): string {
    return code.replace(/^(\s*)(?:const|let|var)\s+\w+\s*=\s*[^;]+;/m, '');
  }

  /**
   * Remove all intermediate variable assignments from the code,
   * simulating aggressive inlining.
   */
  function removeAllIntermediateVars(code: string): string {
    return code.replace(/^\s*(?:const|let|var)\s+\w+\s*=\s*(?!(?:async\s+)?function[\s(])(?!(?:async\s+)?\([^)]*\)\s*=>)[^;]+;\s*$/gm, '');
  }

  /** Arbitrary that produces a variable-breaking refinement (fewer vars). */
  const arbVarBreakingRefinement: fc.Arbitrary<{
    original: string;
    refined: string;
    mutation: string;
  }> = arbIntermediateVarCode.chain((code) =>
    fc
      .constantFrom(
        { fn: removeFirstIntermediateVar, name: 'removeFirst' },
        { fn: removeAllIntermediateVars, name: 'removeAll' },
      )
      .map(({ fn, name }) => ({
        original: code,
        refined: fn(code),
        mutation: name,
      })),
  );

  // -----------------------------------------------------------------------
  // Property tests
  // -----------------------------------------------------------------------

  it(
    'if validator returns safe=true, all intermediate variables are preserved',
    () => {
      /**
       * Validates: Requirements 5.4
       *
       * For any code with intermediate variables, when the validator accepts
       * a refinement, every variable from extractIntermediateVariables(original)
       * must also appear in extractIntermediateVariables(refined).
       */
      fc.assert(
        fc.property(
          arbIntermediateVarCode,
          fc.string({ minLength: 0, maxLength: 800 }),
          (original, refined) => {
            const transformation = makeTransformation(original, refined);
            const context = makeContext(original);
            const result = validator.validate(transformation, context);

            if (result.safe) {
              const origVars = extractIntermediateVariables(original);
              const refVars = extractIntermediateVariables(refined);
              for (const v of origVars) {
                expect(refVars).toContain(v);
              }
            }
          },
        ),
        { numRuns: 150 },
      );
    },
  );

  it(
    'when intermediate variables are inlined (removed), validator rejects',
    () => {
      /**
       * Validates: Requirements 5.4
       *
       * Removing intermediate variables means they were inlined, so the
       * validator must return safe=false.
       */
      fc.assert(
        fc.property(arbVarBreakingRefinement, ({ original, refined, mutation }) => {
          if (original === refined) return; // mutation didn't apply

          const origVars = extractIntermediateVariables(original);
          const refVars = extractIntermediateVariables(refined);

          // Only assert rejection when a variable was actually removed
          const allPreserved = origVars.every((v) => refVars.includes(v));
          if (allPreserved) return;

          const transformation = makeTransformation(original, refined);
          const context = makeContext(original);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason!.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'adding new intermediate variables is accepted',
    () => {
      /**
       * Validates: Requirements 5.4
       *
       * Adding new variables while keeping all originals should be accepted
       * by the validator (preservesIntermediateVars = true).
       */
      fc.assert(
        fc.property(arbAddVarRefinement, ({ original, refined }) => {
          const origVars = extractIntermediateVariables(original);
          const refVars = extractIntermediateVariables(refined);

          // All original vars still present
          for (const v of origVars) {
            expect(refVars).toContain(v);
          }

          // evaluateBalanceChecks should report preservesIntermediateVars = true
          const balance = evaluateBalanceChecks(original, refined);
          expect(balance.preservesIntermediateVars).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'identical code always preserves intermediate variables',
    () => {
      /**
       * Validates: Requirements 5.4
       *
       * When original and refined are the same, intermediate variable
       * preservation trivially holds.
       */
      fc.assert(
        fc.property(arbIntermediateVarCode, (code) => {
          const transformation = makeTransformation(code, code);
          const context = makeContext(code);
          const result = validator.validate(transformation, context);

          expect(result.safe).toBe(true);

          const vars = extractIntermediateVariables(code);
          expect(vars.length).toBeGreaterThanOrEqual(2);

          const balance = evaluateBalanceChecks(code, code);
          expect(balance.preservesIntermediateVars).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );
});
