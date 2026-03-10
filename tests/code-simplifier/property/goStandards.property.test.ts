/**
 * Property tests for Go standard rules.
 *
 * Feature: code-simplifier
 * Tests Properties 9–12 covering Go naming, error handling, early returns,
 * and import grouping rules.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { goStandardRules } from '../../../frontend/src/code-simplifier/rules/go.standard';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

// Resolve individual rules from the exported array
const namingRule = goStandardRules.find((r) => r.id === 'go.standard.naming')!;
const errorHandlingRule = goStandardRules.find((r) => r.id === 'go.standard.error-handling')!;
const earlyReturnsRule = goStandardRules.find((r) => r.id === 'go.standard.early-returns')!;
const importGroupingRule = goStandardRules.find((r) => r.id === 'go.standard.import-grouping')!;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function makeSection(content: string, filePath = 'backend/example.go'): CodeSection {
  const lines = content.split('\n');
  return { filePath, startLine: 1, endLine: lines.length, content };
}

/** Arbitrary for a lowercase Go identifier fragment (2-8 chars). */
const arbWord: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 8,
  })
  .filter((s) => s.length >= 2);

// ---------------------------------------------------------------------------
// Property 9: Go Naming Conventions
//
// For any Go file after refinement, unexported identifiers must use camelCase
// and exported identifiers must use PascalCase (no snake_case).
//
// Feature: code-simplifier, Property 9: Go Naming Conventions
// Validates: Requirements 3.1
// ---------------------------------------------------------------------------

/** Generates a snake_case name from two words. */
const arbSnakeName: fc.Arbitrary<string> = fc
  .tuple(arbWord, arbWord)
  .map(([a, b]) => `${a}_${b}`);

/** Generates an exported snake_case Go declaration (func/type/var/const). */
const arbExportedSnakeDecl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('func', 'type', 'var', 'const'),
    arbSnakeName,
  )
  .map(([keyword, name]) => {
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    if (keyword === 'func') return `${keyword} ${pascal}() {}`;
    if (keyword === 'type') return `${keyword} ${pascal} struct {}`;
    return `${keyword} ${pascal} = 0`;
  });

/** Generates an unexported snake_case Go declaration (func/var/const). */
const arbUnexportedSnakeDecl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('func', 'var', 'const'),
    arbSnakeName,
  )
  .map(([keyword, name]) => {
    if (keyword === 'func') return `${keyword} ${name}() {}`;
    return `${keyword} ${name} = 0`;
  });

/** CodeSection containing Go code with snake_case identifiers. */
const arbSnakeCaseSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbExportedSnakeDecl, { minLength: 0, maxLength: 3 }),
    fc.array(arbUnexportedSnakeDecl, { minLength: 0, maxLength: 3 }),
  )
  .filter(([exp, unexp]) => exp.length + unexp.length > 0)
  .map(([exported, unexported]) => {
    const content = [...exported, ...unexported].join('\n');
    return makeSection(content);
  });

describe('Property 9: Go Naming Conventions', () => {
  it('no snake_case identifiers remain in declarations after transform', () => {
    fc.assert(
      fc.property(arbSnakeCaseSection, (section) => {
        const result = namingRule.transform(section);
        // No declaration line should contain an underscore-separated identifier
        const declPattern = /^(?:func|type|var|const)\s+(\w+)/gm;
        let m: RegExpExecArray | null;
        while ((m = declPattern.exec(result.refined)) !== null) {
          expect(m[1]).not.toMatch(/_/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('match() detects sections with snake_case identifiers', () => {
    fc.assert(
      fc.property(arbSnakeCaseSection, (section) => {
        const violation = namingRule.match(section);
        expect(violation).not.toBeNull();
        expect(violation!.ruleId).toBe('go.standard.naming');
      }),
      { numRuns: 100 },
    );
  });

  it('exported identifiers start with uppercase after transform', () => {
    fc.assert(
      fc.property(
        fc.array(arbExportedSnakeDecl, { minLength: 1, maxLength: 4 }).map((decls) =>
          makeSection(decls.join('\n')),
        ),
        (section) => {
          const result = namingRule.transform(section);
          const declPattern = /^(?:func|type|var|const)\s+([A-Z]\w*)/gm;
          let m: RegExpExecArray | null;
          let found = false;
          while ((m = declPattern.exec(result.refined)) !== null) {
            found = true;
            // First char must be uppercase (PascalCase)
            expect(m[1][0]).toMatch(/[A-Z]/);
            // No underscores
            expect(m[1]).not.toMatch(/_/);
          }
          expect(found).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('transform preserves metadata', () => {
    fc.assert(
      fc.property(arbSnakeCaseSection, (section) => {
        const result = namingRule.transform(section);
        expect(result.original).toBe(section.content);
        expect(result.filePath).toBe(section.filePath);
        expect(result.ruleId).toBe('go.standard.naming');
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 10: Go Error Handling Completeness
//
// For any Go file after refinement, every function call that returns an error
// value must have that error checked and handled at the call site.
//
// Feature: code-simplifier, Property 10: Go Error Handling Completeness
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

/** Generates a Go function name. */
const arbGoFnName: fc.Arbitrary<string> = fc
  .tuple(arbWord, arbWord)
  .map(([a, b]) => `${a}${b.charAt(0).toUpperCase()}${b.slice(1)}`);

/** Generates a `val, _ := fn(...)` line (ignored error). */
const arbIgnoredErrorLine: fc.Arbitrary<string> = fc
  .tuple(arbWord, arbGoFnName)
  .map(([val, fn]) => `\t${val}, _ := ${fn}()`);

/** Generates a plain Go statement (no ignored errors). */
const arbPlainGoLine: fc.Arbitrary<string> = fc.oneof(
  arbWord.map((name) => `\t${name} := 42`),
  fc.constant('\t// comment'),
  fc.constant(''),
);

/** CodeSection with at least one ignored error return. */
const arbIgnoredErrorSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbPlainGoLine, { minLength: 0, maxLength: 2 }),
    fc.array(arbIgnoredErrorLine, { minLength: 1, maxLength: 4 }),
    fc.array(arbPlainGoLine, { minLength: 0, maxLength: 2 }),
  )
  .map(([before, errors, after]) => {
    const lines = ['func example() error {', ...before, ...errors, ...after, '\treturn nil', '}'];
    return makeSection(lines.join('\n'));
  });

describe('Property 10: Go Error Handling Completeness', () => {
  it('no ignored error returns (val, _ :=) remain after transform', () => {
    fc.assert(
      fc.property(arbIgnoredErrorSection, (section) => {
        const result = errorHandlingRule.transform(section);
        // The pattern `val, _ :=` or `val, _ =` should not appear
        expect(result.refined).not.toMatch(/\w+\s*,\s*_\s*:?=\s*\w+/);
      }),
      { numRuns: 100 },
    );
  });

  it('error check blocks are inserted after each transformed call', () => {
    fc.assert(
      fc.property(arbIgnoredErrorSection, (section) => {
        const result = errorHandlingRule.transform(section);
        // For each original ignored error, there should be an `if err != nil` block
        const ignoredCount = (section.content.match(/\w+\s*,\s*_\s*:?=/g) || []).length;
        const errCheckCount = (result.refined.match(/if err != nil/g) || []).length;
        expect(errCheckCount).toBeGreaterThanOrEqual(ignoredCount);
      }),
      { numRuns: 100 },
    );
  });

  it('match() detects sections with ignored error returns', () => {
    fc.assert(
      fc.property(arbIgnoredErrorSection, (section) => {
        const violation = errorHandlingRule.match(section);
        expect(violation).not.toBeNull();
        expect(violation!.ruleId).toBe('go.standard.error-handling');
      }),
      { numRuns: 100 },
    );
  });

  it('transform preserves metadata', () => {
    fc.assert(
      fc.property(arbIgnoredErrorSection, (section) => {
        const result = errorHandlingRule.transform(section);
        expect(result.original).toBe(section.content);
        expect(result.filePath).toBe(section.filePath);
        expect(result.ruleId).toBe('go.standard.error-handling');
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 11: Go Early Returns
//
// For any Go file after refinement containing error conditions, error handling
// must use early return patterns rather than nested else blocks.
//
// Feature: code-simplifier, Property 11: Go Early Returns
// Validates: Requirements 3.3
// ---------------------------------------------------------------------------

/** Generates a Go `if err != nil { ... } else { ... }` block. */
const arbErrorElseBlock: fc.Arbitrary<string> = fc
  .tuple(arbWord, arbWord)
  .map(([errAction, mainAction]) =>
    [
      `\tif err != nil {`,
      `\t\t${errAction} := "failed"`,
      `\t\tlog.Println(${errAction})`,
      `\t} else {`,
      `\t\t${mainAction} := "ok"`,
      `\t\tfmt.Println(${mainAction})`,
      `\t}`,
    ].join('\n'),
  );

/** CodeSection with at least one `if err != nil {} else {}` pattern. */
const arbErrorElseSection: fc.Arbitrary<CodeSection> = fc
  .array(arbErrorElseBlock, { minLength: 1, maxLength: 3 })
  .map((blocks) => {
    const lines = ['func process() error {', ...blocks, '\treturn nil', '}'];
    return makeSection(lines.join('\n'));
  });

describe('Property 11: Go Early Returns', () => {
  it('no else blocks after error checks remain after transform', () => {
    fc.assert(
      fc.property(arbErrorElseSection, (section) => {
        const result = earlyReturnsRule.transform(section);
        // The pattern `if err != nil { ... } else {` should not appear
        expect(result.refined).not.toMatch(/if\s+err\s*!=\s*nil\s*\{[^}]*\}\s*else\s*\{/);
      }),
      { numRuns: 100 },
    );
  });

  it('error blocks contain a return statement after transform', () => {
    fc.assert(
      fc.property(arbErrorElseSection, (section) => {
        const result = earlyReturnsRule.transform(section);
        // Each `if err != nil {` block should contain a return
        const errBlocks = result.refined.match(/if err != nil \{[\s\S]*?\}/g) || [];
        for (const block of errBlocks) {
          expect(block).toMatch(/\breturn\b/);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('match() detects sections with else blocks after error checks', () => {
    fc.assert(
      fc.property(arbErrorElseSection, (section) => {
        const violation = earlyReturnsRule.match(section);
        expect(violation).not.toBeNull();
        expect(violation!.ruleId).toBe('go.standard.early-returns');
      }),
      { numRuns: 100 },
    );
  });

  it('transform preserves metadata', () => {
    fc.assert(
      fc.property(arbErrorElseSection, (section) => {
        const result = earlyReturnsRule.transform(section);
        expect(result.original).toBe(section.content);
        expect(result.filePath).toBe(section.filePath);
        expect(result.ruleId).toBe('go.standard.early-returns');
      }),
      { numRuns: 100 },
    );
  });
});


// ---------------------------------------------------------------------------
// Property 12: Go Import Grouping
//
// For any Go file after refinement, import statements must be grouped into
// standard library, external packages, and internal packages sections, each
// separated by a blank line.
//
// Feature: code-simplifier, Property 12: Go Import Grouping
// Validates: Requirements 3.4
// ---------------------------------------------------------------------------

/** Standard library packages for generating random stdlib imports. */
const stdlibPkgs = ['fmt', 'os', 'io', 'net', 'strings', 'strconv', 'context', 'errors', 'log', 'time'];

/** External packages (domain-based) for generating random external imports. */
const externalPkgs = [
  'github.com/gin-gonic/gin',
  'github.com/stretchr/testify',
  'golang.org/x/sync',
  'google.golang.org/grpc',
  'go.uber.org/zap',
];

/** Arbitrary for a stdlib import line. */
const arbStdlibImport: fc.Arbitrary<string> = fc
  .constantFrom(...stdlibPkgs)
  .map((pkg) => `\t"${pkg}"`);

/** Arbitrary for an external import line. */
const arbExternalImport: fc.Arbitrary<string> = fc
  .constantFrom(...externalPkgs)
  .map((pkg) => `\t"${pkg}"`);

/**
 * Generates a Go import block with mixed stdlib and external packages
 * (no proper grouping — all interleaved).
 */
const arbMixedGoImportSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbStdlibImport, { minLength: 1, maxLength: 4 }),
    fc.array(arbExternalImport, { minLength: 1, maxLength: 3 }),
  )
  .map(([stdlibs, externals]) => {
    // Interleave to create an unsorted/ungrouped import block
    const mixed: string[] = [];
    const maxLen = Math.max(stdlibs.length, externals.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < externals.length) mixed.push(externals[i]);
      if (i < stdlibs.length) mixed.push(stdlibs[i]);
    }
    const content = `package main\n\nimport (\n${mixed.join('\n')}\n)`;
    return makeSection(content);
  });

/**
 * Helper: classify a Go import line as stdlib or external.
 * Mirrors the rule's classification for verification.
 */
function classifyGoImportLine(line: string): 'stdlib' | 'external' | null {
  const match = line.trim().match(/^"([^"]+)"$/);
  if (!match) return null;
  const pkg = match[1];
  const firstSegment = pkg.split('/')[0];
  if (firstSegment.includes('.')) return 'external';
  return 'stdlib';
}

/**
 * Helper: parse the import block from refined output into groups
 * separated by blank lines.
 */
function parseGoImportGroups(refined: string): string[][] {
  const blockMatch = refined.match(/import\s*\(([\s\S]*?)\)/);
  if (!blockMatch) return [];
  const lines = blockMatch[1].split('\n');
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

describe('Property 12: Go Import Grouping', () => {
  it('stdlib imports come before external imports after transform', () => {
    fc.assert(
      fc.property(arbMixedGoImportSection, (section) => {
        const result = importGroupingRule.transform(section);
        const groups = parseGoImportGroups(result.refined);

        if (groups.length >= 2) {
          // First group should be all stdlib
          for (const line of groups[0]) {
            const cat = classifyGoImportLine(line);
            if (cat !== null) expect(cat).toBe('stdlib');
          }
          // Second group should be all external
          for (const line of groups[1]) {
            const cat = classifyGoImportLine(line);
            if (cat !== null) expect(cat).toBe('external');
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('groups are separated by blank lines after transform', () => {
    fc.assert(
      fc.property(arbMixedGoImportSection, (section) => {
        const result = importGroupingRule.transform(section);
        const groups = parseGoImportGroups(result.refined);

        // With both stdlib and external imports, we expect exactly 2 groups
        expect(groups.length).toBe(2);

        // Verify a blank line exists between groups in the raw import block
        const blockMatch = result.refined.match(/import\s*\(([\s\S]*?)\)/);
        expect(blockMatch).not.toBeNull();
        const blockContent = blockMatch![1];
        // There should be at least one blank line separating groups
        expect(blockContent).toMatch(/\n\s*\n/);
      }),
      { numRuns: 100 },
    );
  });

  it('all original imports are preserved after grouping', () => {
    fc.assert(
      fc.property(arbMixedGoImportSection, (section) => {
        const result = importGroupingRule.transform(section);

        // Extract package paths from original
        const originalPkgs = (section.content.match(/"[^"]+"/g) || []).sort();
        // Extract package paths from refined
        const refinedPkgs = (result.refined.match(/"[^"]+"/g) || []).sort();

        expect(refinedPkgs).toEqual(originalPkgs);
      }),
      { numRuns: 100 },
    );
  });

  it('match() detects ungrouped import blocks', () => {
    fc.assert(
      fc.property(arbMixedGoImportSection, (section) => {
        const violation = importGroupingRule.match(section);
        expect(violation).not.toBeNull();
        expect(violation!.ruleId).toBe('go.standard.import-grouping');
      }),
      { numRuns: 100 },
    );
  });

  it('transform preserves metadata', () => {
    fc.assert(
      fc.property(arbMixedGoImportSection, (section) => {
        const result = importGroupingRule.transform(section);
        expect(result.original).toBe(section.content);
        expect(result.filePath).toBe(section.filePath);
        expect(result.ruleId).toBe('go.standard.import-grouping');
      }),
      { numRuns: 100 },
    );
  });
});
