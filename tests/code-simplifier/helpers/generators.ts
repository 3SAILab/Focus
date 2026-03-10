/**
 * Shared fast-check arbitraries for Code Simplifier property-based tests.
 *
 * Each arbitrary produces random instances of the core types defined in
 * frontend/src/code-simplifier/types.ts.
 */
import fc from 'fast-check';
import type {
  CodeSection,
  Transformation,
  ScopeResult,
  RuleViolation,
} from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Arbitrary for a realistic-looking file path (.ts, .tsx, or .go). */
const arbFilePath: fc.Arbitrary<string> = fc.oneof(
  fc.constant('src/').chain((prefix) =>
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 20 }).map(
      (name) => `${prefix}${name}.ts`,
    ),
  ),
  fc.constant('src/components/').chain((prefix) =>
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 20 }).map(
      (name) => `${prefix}${name}.tsx`,
    ),
  ),
  fc.constant('backend/').chain((prefix) =>
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 20 }).map(
      (name) => `${prefix}${name}.go`,
    ),
  ),
);

/** Arbitrary for a positive line number. */
const arbLineNumber: fc.Arbitrary<number> = fc.integer({ min: 1, max: 5000 });

// ---------------------------------------------------------------------------
// Core arbitraries
// ---------------------------------------------------------------------------

/** Generates random {@link CodeSection} objects. */
export const arbCodeSection: fc.Arbitrary<CodeSection> = fc
  .tuple(arbFilePath, arbLineNumber, fc.string({ minLength: 0, maxLength: 200 }))
  .chain(([filePath, start, content]) =>
    fc.integer({ min: start, max: start + 200 }).map((end) => ({
      filePath,
      startLine: start,
      endLine: end,
      content,
    })),
  );

/** Generates random {@link Transformation} objects. */
export const arbTransformation: fc.Arbitrary<Transformation> = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz._-'.split('')), { minLength: 3, maxLength: 40 }),
    arbFilePath,
    fc.string({ minLength: 0, maxLength: 200 }),
    fc.string({ minLength: 0, maxLength: 200 }),
    arbLineNumber,
  )
  .chain(([ruleId, filePath, original, refined, start]) =>
    fc.integer({ min: start, max: start + 200 }).map((end) => ({
      ruleId,
      filePath,
      original,
      refined,
      startLine: start,
      endLine: end,
    })),
  );


/** Generates random {@link ScopeResult} objects. */
export const arbScopeResult: fc.Arbitrary<ScopeResult> = fc
  .tuple(
    fc.array(arbFilePath, { minLength: 0, maxLength: 10 }),
    fc.boolean(),
  )
  .chain(([files, isExplicit]) =>
    fc.array(arbCodeSection, { minLength: 0, maxLength: 5 }).map((sections) => {
      const sectionMap = new Map<string, CodeSection[]>();
      for (const section of sections) {
        const existing = sectionMap.get(section.filePath) ?? [];
        existing.push(section);
        sectionMap.set(section.filePath, existing);
      }
      return { files, sections: sectionMap, isExplicit };
    }),
  );

/** Generates random {@link RuleViolation} objects. */
export const arbRuleViolation: fc.Arbitrary<RuleViolation> = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz._-'.split('')), { minLength: 3, maxLength: 40 }),
    fc.constantFrom('standard' as const, 'clarity' as const),
    arbCodeSection,
    fc.string({ minLength: 1, maxLength: 100 }),
    arbTransformation,
  )
  .map(([ruleId, severity, location, description, suggestedFix]) => ({
    ruleId,
    severity,
    location,
    description,
    suggestedFix,
  }));
