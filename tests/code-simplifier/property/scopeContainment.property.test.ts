/**
 * Property 18: Scope Containment
 *
 * For any refinement pass with default scope, only recently modified files are
 * analyzed, only modified sections (and their immediate surrounding context)
 * within those files are changed, and no files outside the resolved scope are
 * modified.
 *
 * Feature: code-simplifier, Property 18: Scope Containment
 * Validates: Requirements 6.1, 6.3, 6.4
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DefaultFileChangeDetector } from '../../../frontend/src/code-simplifier/pipeline/fileChangeDetector';
import { DefaultScopeResolver } from '../../../frontend/src/code-simplifier/pipeline/scopeResolver';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';
import { arbCodeSection } from '../helpers/generators';

/**
 * Arbitrary that produces a non-empty list of unique file paths, each with at
 * least one associated CodeSection whose filePath matches the key.
 */
const arbModifiedFileSet: fc.Arbitrary<Map<string, CodeSection[]>> = fc
  .array(arbCodeSection, { minLength: 1, maxLength: 10 })
  .map((sections) => {
    const map = new Map<string, CodeSection[]>();
    for (const section of sections) {
      const existing = map.get(section.filePath) ?? [];
      existing.push(section);
      map.set(section.filePath, existing);
    }
    return map;
  });

/**
 * Arbitrary for a set of "extra" file paths that are NOT in the modified set.
 * Used to verify that unmodified files never leak into the scope.
 */
const arbExtraFiles: fc.Arbitrary<string[]> = fc
  .array(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
      minLength: 1,
      maxLength: 15,
    }).map((name) => `unmodified/${name}.ts`),
    { minLength: 0, maxLength: 5 },
  );

describe('Property 18: Scope Containment', () => {
  it(
    'default scope only includes files from the modifiedFiles list',
    () => {
      fc.assert(
        fc.property(arbModifiedFileSet, (modifiedMap) => {
          const detector = new DefaultFileChangeDetector();
          for (const [filePath, sections] of modifiedMap) {
            for (const section of sections) {
              detector.trackModification(filePath, section);
            }
          }

          const resolver = new DefaultScopeResolver(detector);
          const modifiedFiles = Array.from(modifiedMap.keys());
          const result = resolver.resolve(modifiedFiles);

          // Every file in the result must be in the modifiedFiles list
          for (const file of result.files) {
            expect(modifiedFiles).toContain(file);
          }
          // The result must contain exactly the modified files
          expect(result.files).toHaveLength(modifiedFiles.length);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'no files outside the modified set appear in the result',
    () => {
      fc.assert(
        fc.property(
          arbModifiedFileSet,
          arbExtraFiles,
          (modifiedMap, extraFiles) => {
            const detector = new DefaultFileChangeDetector();

            // Track modifications for the "modified" files
            for (const [filePath, sections] of modifiedMap) {
              for (const section of sections) {
                detector.trackModification(filePath, section);
              }
            }

            // Also track the extra files in the detector (simulating other
            // session activity), but do NOT include them in modifiedFiles
            for (const extra of extraFiles) {
              detector.trackModification(extra, {
                filePath: extra,
                startLine: 1,
                endLine: 10,
                content: 'extra',
              });
            }

            const resolver = new DefaultScopeResolver(detector);
            const modifiedFiles = Array.from(modifiedMap.keys());
            const result = resolver.resolve(modifiedFiles);

            // No extra file should appear in the scope result
            for (const extra of extraFiles) {
              expect(result.files).not.toContain(extra);
              expect(result.sections.has(extra)).toBe(false);
            }

            // Scope must not be marked as explicit
            expect(result.isExplicit).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'sections returned for each file match what was tracked in the detector',
    () => {
      fc.assert(
        fc.property(arbModifiedFileSet, (modifiedMap) => {
          const detector = new DefaultFileChangeDetector();
          for (const [filePath, sections] of modifiedMap) {
            for (const section of sections) {
              detector.trackModification(filePath, section);
            }
          }

          const resolver = new DefaultScopeResolver(detector);
          const modifiedFiles = Array.from(modifiedMap.keys());
          const result = resolver.resolve(modifiedFiles);

          // For every file in the scope, the sections must match exactly
          // what the detector reports
          for (const filePath of result.files) {
            const scopeSections = result.sections.get(filePath) ?? [];
            const detectorSections = detector.getModifiedSections(filePath);
            expect(scopeSections).toEqual(detectorSections);
          }

          // No section key should exist for a file not in the files list
          for (const key of result.sections.keys()) {
            expect(result.files).toContain(key);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});


/**
 * Property 19: Explicit Scope Expansion
 *
 * For any refinement pass where a developer provides an explicit scope (files
 * or directories), the simplifier must analyze exactly those specified targets
 * and no others.
 *
 * Feature: code-simplifier, Property 19: Explicit Scope Expansion
 * Validates: Requirements 6.2
 */

/**
 * Arbitrary that produces a non-empty set of unique explicit file paths.
 * Paths are distinct from the "modified" paths used in Property 18 tests.
 */
const arbExplicitPaths: fc.Arbitrary<string[]> = fc
  .array(
    fc.oneof(
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
        minLength: 1,
        maxLength: 15,
      }).map((name) => `explicit/${name}.ts`),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
        minLength: 1,
        maxLength: 15,
      }).map((name) => `explicit/components/${name}.tsx`),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
        minLength: 1,
        maxLength: 15,
      }).map((name) => `explicit/backend/${name}.go`),
    ),
    { minLength: 1, maxLength: 10 },
  )
  .map((paths) => [...new Set(paths)]); // deduplicate

describe('Property 19: Explicit Scope Expansion', () => {
  it(
    'explicit scope result contains exactly the specified paths',
    () => {
      fc.assert(
        fc.property(arbExplicitPaths, (explicitPaths) => {
          const detector = new DefaultFileChangeDetector();
          const resolver = new DefaultScopeResolver(detector);

          const result = resolver.resolve([], explicitPaths);

          // result.files must contain exactly the explicit paths
          expect(result.files).toHaveLength(explicitPaths.length);
          for (const p of explicitPaths) {
            expect(result.files).toContain(p);
          }
          // No extra files
          for (const f of result.files) {
            expect(explicitPaths).toContain(f);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'explicit scope sets isExplicit to true',
    () => {
      fc.assert(
        fc.property(arbExplicitPaths, (explicitPaths) => {
          const detector = new DefaultFileChangeDetector();
          const resolver = new DefaultScopeResolver(detector);

          const result = resolver.resolve([], explicitPaths);

          expect(result.isExplicit).toBe(true);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'modified files do not leak into explicit scope result',
    () => {
      fc.assert(
        fc.property(
          arbExplicitPaths,
          arbModifiedFileSet,
          (explicitPaths, modifiedMap) => {
            const detector = new DefaultFileChangeDetector();

            // Track some modified files in the detector
            for (const [filePath, sections] of modifiedMap) {
              for (const section of sections) {
                detector.trackModification(filePath, section);
              }
            }

            const resolver = new DefaultScopeResolver(detector);
            const modifiedFiles = Array.from(modifiedMap.keys());

            const result = resolver.resolve(modifiedFiles, explicitPaths);

            // Only explicit paths should appear — no modified files leak in
            expect(result.files).toHaveLength(explicitPaths.length);
            for (const f of result.files) {
              expect(explicitPaths).toContain(f);
            }

            // Modified-only files must not appear unless they are also in explicitPaths
            for (const modFile of modifiedFiles) {
              if (!explicitPaths.includes(modFile)) {
                expect(result.files).not.toContain(modFile);
                expect(result.sections.has(modFile)).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'each explicit path gets a full-file CodeSection (startLine: 1, endLine: MAX_SAFE_INTEGER)',
    () => {
      fc.assert(
        fc.property(arbExplicitPaths, (explicitPaths) => {
          const detector = new DefaultFileChangeDetector();
          const resolver = new DefaultScopeResolver(detector);

          const result = resolver.resolve([], explicitPaths);

          for (const p of explicitPaths) {
            const sections = result.sections.get(p);
            expect(sections).toBeDefined();
            expect(sections).toHaveLength(1);

            const section = sections![0];
            expect(section.filePath).toBe(p);
            expect(section.startLine).toBe(1);
            expect(section.endLine).toBe(Number.MAX_SAFE_INTEGER);
          }
        }),
        { numRuns: 100 },
      );
    },
  );
});
