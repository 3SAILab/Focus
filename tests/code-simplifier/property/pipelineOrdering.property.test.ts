/**
 * Property 21: Standards-Before-Clarity Ordering
 *
 * For any refinement pass that applies both standards and clarity
 * transformations, all standards-category transformations must be applied
 * before any clarity-category transformations. Naming falls between standard
 * and clarity.
 *
 * Feature: code-simplifier, Property 21: Standards-Before-Clarity Ordering
 * Validates: Requirements 8.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DefaultRuleEngine } from '../../../frontend/src/code-simplifier/pipeline/ruleEngine';
import type {
  Rule,
  RuleViolation,
  CodeSection,
  Transformation,
  SupportedLanguage,
} from '../../../frontend/src/code-simplifier/types';
import { arbCodeSection } from '../helpers/generators';

// ---------------------------------------------------------------------------
// Helpers — lightweight Rule stubs for testing ordering
// ---------------------------------------------------------------------------

/** Category priority mapping mirroring the engine's internal ordering. */
const CATEGORY_ORDER: Record<string, number> = {
  standard: 0,
  naming: 1,
  clarity: 2,
};

type RuleCategory = 'standard' | 'clarity' | 'naming';

/**
 * Creates a minimal Rule stub with the given id, category, language, and
 * priority. The `match` and `transform` methods return deterministic stubs.
 */
function makeRule(
  id: string,
  category: RuleCategory,
  language: SupportedLanguage,
  priority: number,
): Rule {
  return {
    id,
    language,
    category,
    priority,
    match(_section: CodeSection) {
      return null;
    },
    transform(section: CodeSection): Transformation {
      return {
        ruleId: id,
        filePath: section.filePath,
        original: section.content,
        refined: section.content,
        startLine: section.startLine,
        endLine: section.endLine,
      };
    },
  };
}

/**
 * Creates a RuleViolation tied to a specific rule, with a suggestedFix whose
 * ruleId matches the rule.
 */
function makeViolation(
  rule: Rule,
  section: CodeSection,
): RuleViolation {
  return {
    ruleId: rule.id,
    severity: rule.category === 'clarity' ? 'clarity' : 'standard',
    location: section,
    description: `Violation for ${rule.id}`,
    suggestedFix: {
      ruleId: rule.id,
      filePath: section.filePath,
      original: section.content,
      refined: `refined-by-${rule.id}`,
      startLine: section.startLine,
      endLine: section.endLine,
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a rule category. */
const arbCategory: fc.Arbitrary<RuleCategory> = fc.constantFrom(
  'standard' as const,
  'naming' as const,
  'clarity' as const,
);

/** Arbitrary for a supported language. */
const arbLanguage: fc.Arbitrary<SupportedLanguage> = fc.constantFrom(
  'typescript' as const,
  'go' as const,
);

/** Arbitrary for a rule priority number. */
const arbPriority: fc.Arbitrary<number> = fc.integer({ min: 1, max: 100 });

/**
 * Arbitrary that produces a tuple of (Rule, category) with a unique id.
 * We generate the category separately so we can reason about it in assertions.
 */
const arbRuleSpec = fc.tuple(
  fc.integer({ min: 1, max: 10000 }),
  arbCategory,
  arbLanguage,
  arbPriority,
);

/**
 * Arbitrary that produces a non-empty list of rule specs, ensuring we have
 * at least one standard and one clarity rule so the ordering property is
 * meaningful.
 */
const arbMixedRuleSpecs = fc
  .tuple(
    // At least one standard rule
    fc.tuple(fc.integer({ min: 1, max: 10000 }), arbLanguage, arbPriority),
    // At least one clarity rule
    fc.tuple(fc.integer({ min: 10001, max: 20000 }), arbLanguage, arbPriority),
    // Additional random rules (0–8 more)
    fc.array(arbRuleSpec, { minLength: 0, maxLength: 8 }),
  )
  .map(([stdSpec, claritySpec, extras]) => {
    const rules: Array<{ id: number; category: RuleCategory; language: SupportedLanguage; priority: number }> = [
      { id: stdSpec[0], category: 'standard', language: stdSpec[1], priority: stdSpec[2] },
      { id: claritySpec[0], category: 'clarity', language: claritySpec[1], priority: claritySpec[2] },
      ...extras.map(([id, cat, lang, prio]) => ({ id, category: cat, language: lang, priority: prio })),
    ];
    return rules;
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 21: Standards-Before-Clarity Ordering', () => {
  it(
    'matchRules returns all standard transformations before any clarity transformations',
    () => {
      fc.assert(
        fc.property(
          arbMixedRuleSpecs,
          fc.array(arbCodeSection, { minLength: 1, maxLength: 10 }),
          (ruleSpecs, sections) => {
            // Build Rule objects
            const rules = ruleSpecs.map((spec) =>
              makeRule(`rule-${spec.id}`, spec.category, spec.language, spec.priority),
            );

            const engine = new DefaultRuleEngine(rules);

            // Build violations — one per rule, using a random section
            const violations: RuleViolation[] = rules.map((rule, i) =>
              makeViolation(rule, sections[i % sections.length]),
            );

            // Shuffle violations to ensure the engine sorts them, not us
            const shuffled = [...violations].sort(() => Math.random() - 0.5);

            const transformations = engine.matchRules(shuffled);

            // Extract the category for each transformation via its ruleId
            const ruleMap = new Map(rules.map((r) => [r.id, r]));
            const categories = transformations.map((t) => {
              const rule = ruleMap.get(t.ruleId);
              return rule ? rule.category : 'unknown';
            });

            // Verify ordering: once we see a 'naming' category, no 'standard'
            // should follow. Once we see 'clarity', neither 'standard' nor
            // 'naming' should follow.
            let maxCategorySeen = -1;
            for (const cat of categories) {
              const order = CATEGORY_ORDER[cat] ?? -1;
              expect(order).toBeGreaterThanOrEqual(maxCategorySeen);
              maxCategorySeen = Math.max(maxCategorySeen, order);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'getPrioritizedRules returns rules in standard → naming → clarity order',
    () => {
      fc.assert(
        fc.property(
          arbMixedRuleSpecs,
          arbLanguage,
          (ruleSpecs, language) => {
            // Build rules, all for the same language so filtering doesn't remove them
            const rules = ruleSpecs.map((spec) =>
              makeRule(`rule-${spec.id}`, spec.category, language, spec.priority),
            );

            const engine = new DefaultRuleEngine(rules);
            const prioritized = engine.getPrioritizedRules(language);

            // Verify category ordering
            let maxCategorySeen = -1;
            for (const rule of prioritized) {
              const order = CATEGORY_ORDER[rule.category];
              expect(order).toBeGreaterThanOrEqual(maxCategorySeen);
              maxCategorySeen = Math.max(maxCategorySeen, order);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'within the same category, rules are ordered by priority number',
    () => {
      fc.assert(
        fc.property(
          arbMixedRuleSpecs,
          arbLanguage,
          (ruleSpecs, language) => {
            const rules = ruleSpecs.map((spec) =>
              makeRule(`rule-${spec.id}`, spec.category, language, spec.priority),
            );

            const engine = new DefaultRuleEngine(rules);
            const prioritized = engine.getPrioritizedRules(language);

            // Group by category and verify priority ordering within each group
            let prevCategory = '';
            let prevPriority = -Infinity;
            for (const rule of prioritized) {
              if (rule.category !== prevCategory) {
                prevPriority = -Infinity;
                prevCategory = rule.category;
              }
              expect(rule.priority).toBeGreaterThanOrEqual(prevPriority);
              prevPriority = rule.priority;
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 20: Single-Pass Completeness
//
// For any set of code modifications, the pipeline must identify all refinement
// opportunities in the changed sections and process all of them in a single
// pass. This means:
//   1. Total transformations (applied + discarded) === total violations found
//   2. Each section is analyzed exactly once (analyzer.analyze called once per section)
//   3. Every violation's suggestedFix appears in either applied or discarded
//
// Feature: code-simplifier, Property 20: Single-Pass Completeness
// Validates: Requirements 7.1, 7.3
// ---------------------------------------------------------------------------

import { DefaultRefinementPipeline } from '../../../frontend/src/code-simplifier/pipeline/refinementPipeline';
import type {
  FileChangeDetector,
  ScopeResolver,
  LanguageRouter,
  LanguageAnalyzer,
  RuleEngine,
  BehaviorPreservationValidator,
  RuleViolation,
  ScopeResult,
} from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Arbitraries for Property 20
// ---------------------------------------------------------------------------

/** Arbitrary for a number of files (1–5). */
const arbFileCount = fc.integer({ min: 1, max: 5 });

/** Arbitrary for a number of sections per file (1–4). */
const arbSectionCount = fc.integer({ min: 1, max: 4 });

/** Arbitrary for a number of violations per section (0–5). */
const arbViolationCount = fc.integer({ min: 0, max: 5 });

/** Arbitrary for whether a transformation is safe (true) or unsafe (false). */
const arbSafe = fc.boolean();

/**
 * Generates a test scenario: a list of files, each with sections, each with
 * a number of violations and a safety flag per violation.
 */
interface ViolationSpec {
  safe: boolean;
}

interface SectionSpec {
  violations: ViolationSpec[];
}

interface FileSpec {
  filePath: string;
  sections: SectionSpec[];
}

const arbScenario: fc.Arbitrary<FileSpec[]> = fc
  .tuple(arbFileCount, arbSectionCount, arbViolationCount)
  .chain(([fileCount, maxSections, maxViolations]) =>
    fc.array(
      fc.tuple(
        fc.integer({ min: 1, max: maxSections }),
        fc.integer({ min: 0, max: maxViolations }),
      ).chain(([sectionCount, violationCount]) =>
        fc.array(
          fc.array(arbSafe, { minLength: violationCount, maxLength: violationCount }),
          { minLength: sectionCount, maxLength: sectionCount },
        ).map((sectionSafeFlags) =>
          sectionSafeFlags.map((flags) => ({
            violations: flags.map((safe) => ({ safe })),
          })),
        ),
      ),
      { minLength: fileCount, maxLength: fileCount },
    ).map((fileSections, ) =>
      fileSections.map((sections, i) => ({
        filePath: `src/file${i}.ts`,
        sections,
      })),
    ),
  );

// ---------------------------------------------------------------------------
// Property 20 tests
// ---------------------------------------------------------------------------

describe('Property 20: Single-Pass Completeness', () => {
  it(
    'all violations are processed in a single pass — total transformations equals total violations',
    () => {
      fc.assert(
        fc.property(arbScenario, (files) => {
          // Track analyze calls per section
          const analyzeCalls: string[] = [];

          // Build all violations upfront so we can verify them later
          const allViolations: RuleViolation[] = [];
          const safetyMap = new Map<string, boolean>(); // ruleId → safe

          let violationCounter = 0;
          const fileSectionsMap = new Map<string, CodeSection[]>();

          for (const file of files) {
            const sections: CodeSection[] = [];
            for (let si = 0; si < file.sections.length; si++) {
              const sectionSpec = file.sections[si];
              const section: CodeSection = {
                filePath: file.filePath,
                startLine: si * 100 + 1,
                endLine: si * 100 + 50,
                content: `// section ${si} of ${file.filePath}`,
              };
              sections.push(section);

              for (const vSpec of sectionSpec.violations) {
                const ruleId = `rule-${violationCounter++}`;
                const violation: RuleViolation = {
                  ruleId,
                  severity: 'standard',
                  location: section,
                  description: `Violation ${ruleId}`,
                  suggestedFix: {
                    ruleId,
                    filePath: file.filePath,
                    original: section.content,
                    refined: `refined-${ruleId}`,
                    startLine: section.startLine,
                    endLine: section.endLine,
                  },
                };
                allViolations.push(violation);
                safetyMap.set(ruleId, vSpec.safe);
              }
            }
            fileSectionsMap.set(file.filePath, sections);
          }

          // Build a lookup: filePath+sectionKey → violations for that section
          const sectionViolationMap = new Map<string, RuleViolation[]>();
          for (const v of allViolations) {
            const key = `${v.location.filePath}:${v.location.startLine}-${v.location.endLine}`;
            const existing = sectionViolationMap.get(key) ?? [];
            existing.push(v);
            sectionViolationMap.set(key, existing);
          }

          // Mock FileChangeDetector
          const fileChangeDetector: FileChangeDetector = {
            getModifiedFiles: () => files.map((f) => f.filePath),
            getModifiedSections: (filePath: string) =>
              fileSectionsMap.get(filePath) ?? [],
          };

          // Mock ScopeResolver
          const scopeResolver: ScopeResolver = {
            resolve: (modifiedFiles: string[]) => ({
              files: modifiedFiles,
              sections: fileSectionsMap,
              isExplicit: false,
            }),
          };

          // Mock LanguageRouter — returns an analyzer that tracks calls
          const languageRouter: LanguageRouter = {
            route: (_filePath: string): LanguageAnalyzer => ({
              language: 'typescript',
              analyze: (section: CodeSection): RuleViolation[] => {
                const key = `${section.filePath}:${section.startLine}-${section.endLine}`;
                analyzeCalls.push(key);
                return sectionViolationMap.get(key) ?? [];
              },
            }),
          };

          // Mock RuleEngine — returns the suggestedFix from each violation as-is
          const ruleEngine: RuleEngine = {
            matchRules: (violations: RuleViolation[]): Transformation[] =>
              violations.map((v) => v.suggestedFix),
            getPrioritizedRules: () => [],
          };

          // Mock BehaviorPreservationValidator — uses the safetyMap
          const behaviorValidator: BehaviorPreservationValidator = {
            validate: (transformation: Transformation) => ({
              safe: safetyMap.get(transformation.ruleId) ?? true,
            }),
          };

          // Run the pipeline
          const pipeline = new DefaultRefinementPipeline({
            fileChangeDetector,
            scopeResolver,
            languageRouter,
            ruleEngine,
            behaviorValidator,
          });

          const report = pipeline.run();

          // --- Assertion 1: total transformations === total violations ---
          const totalTransformations =
            report.transformationsApplied.length +
            report.transformationsDiscarded.length;
          expect(totalTransformations).toBe(allViolations.length);

          // --- Assertion 2: each section analyzed exactly once ---
          const expectedSectionKeys = new Set<string>();
          for (const file of files) {
            const sections = fileSectionsMap.get(file.filePath) ?? [];
            for (const section of sections) {
              expectedSectionKeys.add(
                `${section.filePath}:${section.startLine}-${section.endLine}`,
              );
            }
          }
          // Each key should appear exactly once
          const callCounts = new Map<string, number>();
          for (const key of analyzeCalls) {
            callCounts.set(key, (callCounts.get(key) ?? 0) + 1);
          }
          for (const key of expectedSectionKeys) {
            expect(callCounts.get(key) ?? 0).toBe(1);
          }
          // No extra calls beyond expected sections
          expect(analyzeCalls.length).toBe(expectedSectionKeys.size);

          // --- Assertion 3: every violation's suggestedFix in applied or discarded ---
          const allReportRuleIds = new Set([
            ...report.transformationsApplied.map((t) => t.ruleId),
            ...report.transformationsDiscarded.map((t) => t.ruleId),
          ]);
          for (const violation of allViolations) {
            expect(allReportRuleIds.has(violation.suggestedFix.ruleId)).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'safe violations end up in applied, unsafe violations end up in discarded',
    () => {
      fc.assert(
        fc.property(arbScenario, (files) => {
          const allViolations: RuleViolation[] = [];
          const safetyMap = new Map<string, boolean>();
          let violationCounter = 0;
          const fileSectionsMap = new Map<string, CodeSection[]>();

          for (const file of files) {
            const sections: CodeSection[] = [];
            for (let si = 0; si < file.sections.length; si++) {
              const sectionSpec = file.sections[si];
              const section: CodeSection = {
                filePath: file.filePath,
                startLine: si * 100 + 1,
                endLine: si * 100 + 50,
                content: `// section ${si}`,
              };
              sections.push(section);

              for (const vSpec of sectionSpec.violations) {
                const ruleId = `rule-${violationCounter++}`;
                allViolations.push({
                  ruleId,
                  severity: 'standard',
                  location: section,
                  description: `Violation ${ruleId}`,
                  suggestedFix: {
                    ruleId,
                    filePath: file.filePath,
                    original: section.content,
                    refined: `refined-${ruleId}`,
                    startLine: section.startLine,
                    endLine: section.endLine,
                  },
                });
                safetyMap.set(ruleId, vSpec.safe);
              }
            }
            fileSectionsMap.set(file.filePath, sections);
          }

          const sectionViolationMap = new Map<string, RuleViolation[]>();
          for (const v of allViolations) {
            const key = `${v.location.filePath}:${v.location.startLine}-${v.location.endLine}`;
            const existing = sectionViolationMap.get(key) ?? [];
            existing.push(v);
            sectionViolationMap.set(key, existing);
          }

          const pipeline = new DefaultRefinementPipeline({
            fileChangeDetector: {
              getModifiedFiles: () => files.map((f) => f.filePath),
              getModifiedSections: (fp: string) => fileSectionsMap.get(fp) ?? [],
            },
            scopeResolver: {
              resolve: (mf: string[]) => ({
                files: mf,
                sections: fileSectionsMap,
                isExplicit: false,
              }),
            },
            languageRouter: {
              route: () => ({
                language: 'typescript' as const,
                analyze: (section: CodeSection) => {
                  const key = `${section.filePath}:${section.startLine}-${section.endLine}`;
                  return sectionViolationMap.get(key) ?? [];
                },
              }),
            },
            ruleEngine: {
              matchRules: (violations: RuleViolation[]) =>
                violations.map((v) => v.suggestedFix),
              getPrioritizedRules: () => [],
            },
            behaviorValidator: {
              validate: (t: Transformation) => ({
                safe: safetyMap.get(t.ruleId) ?? true,
              }),
            },
          });

          const report = pipeline.run();

          // Safe violations → applied, unsafe → discarded
          const appliedIds = new Set(report.transformationsApplied.map((t) => t.ruleId));
          const discardedIds = new Set(report.transformationsDiscarded.map((t) => t.ruleId));

          for (const v of allViolations) {
            const isSafe = safetyMap.get(v.ruleId) ?? true;
            if (isSafe) {
              expect(appliedIds.has(v.ruleId)).toBe(true);
            } else {
              expect(discardedIds.has(v.ruleId)).toBe(true);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 22: Post-Refinement Compilation
//
// For any refinement applied by the Code Simplifier, the resulting code must
// compile successfully and maintain type correctness. This means:
//   1. When postValidator returns true for a file, all that file's
//      transformations remain in `applied`
//   2. When postValidator returns false for a file, all that file's
//      transformations are moved to `discarded` and rollback is called
//   3. The pipeline never has transformations in `applied` for a file that
//      failed post-validation
//
// Feature: code-simplifier, Property 22: Post-Refinement Compilation
// Validates: Requirements 8.4
// ---------------------------------------------------------------------------

/**
 * Arbitrary that generates a scenario with multiple files, each having
 * sections with violations, plus a boolean indicating whether the file
 * passes post-validation (compilation).
 */
interface FileCompilationSpec {
  filePath: string;
  sections: SectionSpec[];
  compilesSuccessfully: boolean;
}

const arbCompilationScenario: fc.Arbitrary<FileCompilationSpec[]> = fc
  .array(
    fc.tuple(
      fc.integer({ min: 1, max: 4 }), // section count
      fc.integer({ min: 1, max: 3 }), // violations per section
      fc.boolean(),                    // compiles successfully
    ),
    { minLength: 1, maxLength: 5 },
  )
  .map((specs) =>
    specs.map(([sectionCount, violationCount, compilesSuccessfully], fileIdx) => ({
      filePath: `src/compile-test-${fileIdx}.ts`,
      sections: Array.from({ length: sectionCount }, () => ({
        violations: Array.from({ length: violationCount }, () => ({ safe: true })),
      })),
      compilesSuccessfully,
    })),
  );

/**
 * Builds mock pipeline dependencies for a compilation scenario.
 * Returns the pipeline and tracking structures for assertions.
 */
function buildCompilationPipeline(files: FileCompilationSpec[]) {
  const fileSectionsMap = new Map<string, CodeSection[]>();
  const allViolations: RuleViolation[] = [];
  const sectionViolationMap = new Map<string, RuleViolation[]>();
  let violationCounter = 0;

  for (const file of files) {
    const sections: CodeSection[] = [];
    for (let si = 0; si < file.sections.length; si++) {
      const section: CodeSection = {
        filePath: file.filePath,
        startLine: si * 100 + 1,
        endLine: si * 100 + 50,
        content: `// section ${si} of ${file.filePath}`,
      };
      sections.push(section);

      for (const _vSpec of file.sections[si].violations) {
        const ruleId = `compile-rule-${violationCounter++}`;
        const violation: RuleViolation = {
          ruleId,
          severity: 'standard',
          location: section,
          description: `Violation ${ruleId}`,
          suggestedFix: {
            ruleId,
            filePath: file.filePath,
            original: section.content,
            refined: `refined-${ruleId}`,
            startLine: section.startLine,
            endLine: section.endLine,
          },
        };
        allViolations.push(violation);
        const key = `${section.filePath}:${section.startLine}-${section.endLine}`;
        const existing = sectionViolationMap.get(key) ?? [];
        existing.push(violation);
        sectionViolationMap.set(key, existing);
      }
    }
    fileSectionsMap.set(file.filePath, sections);
  }

  // Track which files had rollback called
  const rolledBackFiles: string[] = [];

  // Build the compilation result map
  const compilationMap = new Map<string, boolean>();
  for (const file of files) {
    compilationMap.set(file.filePath, file.compilesSuccessfully);
  }

  const pipeline = new DefaultRefinementPipeline({
    fileChangeDetector: {
      getModifiedFiles: () => files.map((f) => f.filePath),
      getModifiedSections: (fp: string) => fileSectionsMap.get(fp) ?? [],
    },
    scopeResolver: {
      resolve: (mf: string[]) => ({
        files: mf,
        sections: fileSectionsMap,
        isExplicit: false,
      }),
    },
    languageRouter: {
      route: () => ({
        language: 'typescript' as const,
        analyze: (section: CodeSection) => {
          const key = `${section.filePath}:${section.startLine}-${section.endLine}`;
          return sectionViolationMap.get(key) ?? [];
        },
      }),
    },
    ruleEngine: {
      matchRules: (violations: RuleViolation[]) =>
        violations.map((v) => v.suggestedFix),
      getPrioritizedRules: () => [],
    },
    behaviorValidator: {
      validate: () => ({ safe: true }),
    },
    postValidator: (filePath: string) => compilationMap.get(filePath) ?? true,
    rollbackTransformations: (filePath: string, _originals: Transformation[]) => {
      rolledBackFiles.push(filePath);
    },
  });

  return { pipeline, allViolations, rolledBackFiles, compilationMap };
}

// ---------------------------------------------------------------------------
// Property 22 tests
// ---------------------------------------------------------------------------

describe('Property 22: Post-Refinement Compilation', () => {
  it(
    'files passing post-validation keep transformations in applied, failing files move them to discarded',
    () => {
      fc.assert(
        fc.property(arbCompilationScenario, (files) => {
          const { pipeline, compilationMap } = buildCompilationPipeline(files);
          const report = pipeline.run();

          // Group applied/discarded by file
          const appliedByFile = new Map<string, Transformation[]>();
          for (const t of report.transformationsApplied) {
            const existing = appliedByFile.get(t.filePath) ?? [];
            existing.push(t);
            appliedByFile.set(t.filePath, existing);
          }

          const discardedByFile = new Map<string, Transformation[]>();
          for (const t of report.transformationsDiscarded) {
            const existing = discardedByFile.get(t.filePath) ?? [];
            existing.push(t);
            discardedByFile.set(t.filePath, existing);
          }

          for (const file of files) {
            const compiles = compilationMap.get(file.filePath) ?? true;
            const appliedForFile = appliedByFile.get(file.filePath) ?? [];
            const discardedForFile = discardedByFile.get(file.filePath) ?? [];

            if (compiles) {
              // All transformations for this file should be in applied
              expect(appliedForFile.length).toBeGreaterThan(0);
              expect(discardedForFile.length).toBe(0);
            } else {
              // All transformations for this file should be in discarded
              expect(appliedForFile.length).toBe(0);
              expect(discardedForFile.length).toBeGreaterThan(0);
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'rollback is called for every file that fails post-validation',
    () => {
      fc.assert(
        fc.property(arbCompilationScenario, (files) => {
          const { pipeline, rolledBackFiles, compilationMap } =
            buildCompilationPipeline(files);
          pipeline.run();

          const failingFiles = files
            .filter((f) => !compilationMap.get(f.filePath))
            .map((f) => f.filePath);

          // Every failing file should have had rollback called
          for (const fp of failingFiles) {
            expect(rolledBackFiles).toContain(fp);
          }

          // No passing file should have had rollback called
          const passingFiles = files
            .filter((f) => compilationMap.get(f.filePath))
            .map((f) => f.filePath);
          for (const fp of passingFiles) {
            expect(rolledBackFiles).not.toContain(fp);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'no transformations in applied belong to a file that failed post-validation',
    () => {
      fc.assert(
        fc.property(arbCompilationScenario, (files) => {
          const { pipeline, compilationMap } = buildCompilationPipeline(files);
          const report = pipeline.run();

          const failingFilePaths = new Set(
            files
              .filter((f) => !compilationMap.get(f.filePath))
              .map((f) => f.filePath),
          );

          // No applied transformation should reference a failing file
          for (const t of report.transformationsApplied) {
            expect(failingFilePaths.has(t.filePath)).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
