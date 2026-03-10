/**
 * Property 4: ES Module Enforcement
 *
 * For any TypeScript file after refinement, all import and export statements
 * must use ES module syntax exclusively (no `require()` or `module.exports`).
 *
 * Feature: code-simplifier, Property 4: ES Module Enforcement
 * Validates: Requirements 2.1
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tsStandardRules } from '../../../frontend/src/code-simplifier/rules/ts.standard';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

// Find the es-modules rule from the exported rules array
const esModulesRule = tsStandardRules.find((r) => r.id === 'ts.standard.es-modules')!;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Arbitrary for a valid JS/TS identifier name. */
const arbIdentifier: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 12,
  })
  .filter((s) => s.length >= 2);

/** Arbitrary for a package/module specifier. */
const arbPackage: fc.Arbitrary<string> = fc.oneof(
  arbIdentifier, // bare package: "lodash"
  fc.tuple(arbIdentifier, arbIdentifier).map(([org, pkg]) => `@${org}/${pkg}`), // scoped: "@org/pkg"
  fc.tuple(arbIdentifier, arbIdentifier).map(([dir, file]) => `./${dir}/${file}`), // relative
);

/** Generates a `const X = require('pkg');` line. */
const arbRequireLine: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('const', 'let', 'var'),
    arbIdentifier,
    arbPackage,
  )
  .map(([kw, name, pkg]) => `${kw} ${name} = require('${pkg}');`);

/** Generates a `module.exports = X;` line. */
const arbModuleExportsLine: fc.Arbitrary<string> = fc
  .tuple(arbIdentifier)
  .map(([name]) => `module.exports = ${name};`);

/** Generates an `exports.X = Y;` line. */
const arbExportsDotLine: fc.Arbitrary<string> = fc
  .tuple(arbIdentifier, arbIdentifier)
  .map(([name, value]) => `exports.${name} = ${value};`);

/** Generates a plain code line (no CJS patterns). */
const arbPlainLine: fc.Arbitrary<string> = fc.oneof(
  arbIdentifier.map((name) => `const ${name} = 42;`),
  arbIdentifier.map((name) => `function ${name}() { return true; }`),
  fc.constant('// a comment'),
  fc.constant(''),
);

/**
 * Generates a CodeSection containing at least one CJS pattern
 * (require, module.exports, or exports.X).
 */
const arbCjsCodeSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(arbPlainLine, { minLength: 0, maxLength: 3 }),
    fc.array(arbRequireLine, { minLength: 0, maxLength: 3 }),
    fc.array(arbModuleExportsLine, { minLength: 0, maxLength: 1 }),
    fc.array(arbExportsDotLine, { minLength: 0, maxLength: 3 }),
    fc.array(arbPlainLine, { minLength: 0, maxLength: 3 }),
  )
  .filter(([, requires, moduleExports, exportsDot]) =>
    requires.length + moduleExports.length + exportsDot.length > 0,
  )
  .map(([before, requires, moduleExports, exportsDot, after]) => {
    const lines = [...before, ...requires, ...moduleExports, ...exportsDot, ...after];
    return {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: lines.length,
      content: lines.join('\n'),
    };
  });

/**
 * Generates a CodeSection with a mix of require() calls and ES import statements.
 */
const arbMixedImportSection: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(
      fc.tuple(arbIdentifier, arbPackage).map(
        ([name, pkg]) => `import ${name} from '${pkg}';`,
      ),
      { minLength: 1, maxLength: 3 },
    ),
    fc.array(arbRequireLine, { minLength: 1, maxLength: 3 }),
  )
  .map(([esImports, requires]) => {
    const lines = [...esImports, ...requires];
    return {
      filePath: 'src/mixed.ts',
      startLine: 1,
      endLine: lines.length,
      content: lines.join('\n'),
    };
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 4: ES Module Enforcement', () => {
  it(
    'no require() calls remain after transform',
    () => {
      fc.assert(
        fc.property(arbCjsCodeSection, (section) => {
          const result = esModulesRule.transform(section);
          expect(result.refined).not.toMatch(/\brequire\s*\(/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'no module.exports remain after transform',
    () => {
      fc.assert(
        fc.property(arbCjsCodeSection, (section) => {
          const result = esModulesRule.transform(section);
          expect(result.refined).not.toMatch(/\bmodule\.exports\b/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'no exports.X assignments remain after transform',
    () => {
      fc.assert(
        fc.property(arbCjsCodeSection, (section) => {
          const result = esModulesRule.transform(section);
          expect(result.refined).not.toMatch(/\bexports\.\w+\s*=/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'mixed CJS and ES imports: CJS patterns removed, ES imports preserved',
    () => {
      fc.assert(
        fc.property(arbMixedImportSection, (section) => {
          const result = esModulesRule.transform(section);

          // No CJS patterns
          expect(result.refined).not.toMatch(/\brequire\s*\(/);
          expect(result.refined).not.toMatch(/\bmodule\.exports\b/);

          // ES import statements should still be present
          expect(result.refined).toMatch(/\bimport\b/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects all sections containing CJS patterns',
    () => {
      fc.assert(
        fc.property(arbCjsCodeSection, (section) => {
          const violation = esModulesRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.standard.es-modules');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves the original in the transformation metadata',
    () => {
      fc.assert(
        fc.property(arbCjsCodeSection, (section) => {
          const result = esModulesRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 5: Import Sort Order
//
// For any TypeScript file after refinement, import statements must be ordered
// with external packages first, then internal modules, then relative imports,
// with each group separated by a blank line.
//
// Feature: code-simplifier, Property 5: Import Sort Order
// Validates: Requirements 2.2
// ---------------------------------------------------------------------------

const importSortRule = tsStandardRules.find((r) => r.id === 'ts.standard.import-sort')!;

// ---------------------------------------------------------------------------
// Generators for Property 5
// ---------------------------------------------------------------------------

/** Arbitrary for a simple identifier (lowercase letters). */
const arbIdent: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 2,
    maxLength: 10,
  })
  .filter((s) => s.length >= 2);

/** Generates an external import: `import X from 'package';` */
const arbExternalImport: fc.Arbitrary<string> = fc
  .tuple(arbIdent, arbIdent)
  .map(([name, pkg]) => `import ${name} from '${pkg}';`);

/** Generates a scoped external import: `import X from '@org/package';` */
const arbScopedExternalImport: fc.Arbitrary<string> = fc
  .tuple(arbIdent, arbIdent, arbIdent)
  .map(([name, org, pkg]) => `import ${name} from '@${org}/${pkg}';`);

/** Generates an internal import: `import X from '@/path/module';` */
const arbInternalImport: fc.Arbitrary<string> = fc
  .tuple(arbIdent, arbIdent)
  .map(([name, mod]) => `import ${name} from '@/${mod}';`);

/** Generates a relative import: `import X from './path/module';` */
const arbRelativeImport: fc.Arbitrary<string> = fc
  .tuple(arbIdent, arbIdent)
  .map(([name, mod]) => `import ${name} from './${mod}';`);

/** Generates a mixed set of imports (at least 2 from different groups). */
const arbMixedImports: fc.Arbitrary<CodeSection> = fc
  .tuple(
    fc.array(fc.oneof(arbExternalImport, arbScopedExternalImport), { minLength: 1, maxLength: 4 }),
    fc.array(arbInternalImport, { minLength: 1, maxLength: 3 }),
    fc.array(arbRelativeImport, { minLength: 1, maxLength: 3 }),
  )
  .map(([externals, internals, relatives]) => {
    // Shuffle all imports together to create an unsorted mix
    const all = [...externals, ...internals, ...relatives];
    // Interleave: alternate picking from each group
    const shuffled: string[] = [];
    const maxLen = Math.max(externals.length, internals.length, relatives.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < relatives.length) shuffled.push(relatives[i]);
      if (i < externals.length) shuffled.push(externals[i]);
      if (i < internals.length) shuffled.push(internals[i]);
    }
    const content = shuffled.join('\n');
    return {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: shuffled.length,
      content,
    };
  });

/**
 * Helper: classify an import line's specifier as external, internal, or relative.
 * Mirrors the rule's classification logic for verification.
 */
function classifyImportLine(line: string): 'external' | 'internal' | 'relative' | null {
  const match = line.match(/^import\s+.*from\s+['"]([^'"]+)['"];?\s*$/);
  if (!match) return null;
  const specifier = match[1];
  if (specifier.startsWith('.')) return 'relative';
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) return 'internal';
  return 'external';
}

/**
 * Helper: parse the refined output into groups separated by blank lines.
 * Returns an array of groups, where each group is an array of non-empty lines.
 */
function parseImportGroups(refined: string): string[][] {
  const lines = refined.split('\n');
  const groups: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 5: Import Sort Order', () => {
  it(
    'external imports come first in the output',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);
          const groups = parseImportGroups(result.refined);

          // First group should be all external
          if (groups.length > 0) {
            for (const line of groups[0]) {
              const cat = classifyImportLine(line);
              if (cat !== null) {
                expect(cat).toBe('external');
              }
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'internal imports come second in the output',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);
          const groups = parseImportGroups(result.refined);

          // Second group (if present) should be all internal
          if (groups.length > 1) {
            for (const line of groups[1]) {
              const cat = classifyImportLine(line);
              if (cat !== null) {
                expect(cat).toBe('internal');
              }
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'relative imports come last in the output',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);
          const groups = parseImportGroups(result.refined);

          // Last group should be all relative
          const lastGroup = groups[groups.length - 1];
          if (lastGroup) {
            for (const line of lastGroup) {
              const cat = classifyImportLine(line);
              if (cat !== null) {
                expect(cat).toBe('relative');
              }
            }
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'groups are separated by blank lines',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);
          const groups = parseImportGroups(result.refined);

          // With imports from all 3 categories, we expect exactly 3 groups
          // The parseImportGroups helper splits on blank lines, so if we get
          // 3 groups, blank lines are present between them.
          expect(groups.length).toBe(3);

          // Verify blank lines exist in the raw output between groups
          const lines = result.refined.split('\n');
          let blankLineCount = 0;
          for (const line of lines) {
            if (line.trim() === '') blankLineCount++;
          }
          // At least 2 blank lines (one between each pair of groups)
          expect(blankLineCount).toBeGreaterThanOrEqual(2);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'all original imports are preserved after sorting',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);

          // Extract import specifiers from original
          const originalSpecifiers = section.content
            .split('\n')
            .map((l) => l.match(/from\s+['"]([^'"]+)['"]/))
            .filter(Boolean)
            .map((m) => m![1])
            .sort();

          // Extract import specifiers from refined
          const refinedSpecifiers = result.refined
            .split('\n')
            .filter((l) => l.trim() !== '')
            .map((l) => l.match(/from\s+['"]([^'"]+)['"]/))
            .filter(Boolean)
            .map((m) => m![1])
            .sort();

          expect(refinedSpecifiers).toEqual(originalSpecifiers);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata (filePath, startLine, endLine, original)',
    () => {
      fc.assert(
        fc.property(arbMixedImports, (section) => {
          const result = importSortRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.startLine).toBe(section.startLine);
          expect(result.endLine).toBe(section.endLine);
          expect(result.ruleId).toBe('ts.standard.import-sort');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 6: Function Keyword Usage
//
// For any TypeScript or React file after refinement, all named function
// declarations must use the `function` keyword rather than arrow function
// expressions assigned to variables.
//
// Feature: code-simplifier, Property 6: Function Keyword Usage
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------

const functionKeywordRule = tsStandardRules.find((r) => r.id === 'ts.standard.function-keyword')!;

// ---------------------------------------------------------------------------
// Generators for Property 6
// ---------------------------------------------------------------------------

/** Arbitrary for a camelCase function name. */
const arbFnName: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 3,
    maxLength: 10,
  })
  .filter((s) => s.length >= 3);

/** Arbitrary for a simple parameter list. */
const arbParams: fc.Arbitrary<string> = fc
  .array(arbFnName, { minLength: 0, maxLength: 3 })
  .map((names) => {
    const unique = [...new Set(names)];
    return unique.map((n) => `${n}: string`).join(', ');
  });

/** Arbitrary for an optional return type annotation. */
const arbReturnType: fc.Arbitrary<string> = fc.constantFrom('', ': void', ': string', ': number');

/** Generates an arrow function expression assigned to a const (named declaration). */
const arbArrowFnDecl: fc.Arbitrary<string> = fc
  .tuple(
    fc.boolean(), // export?
    fc.boolean(), // async?
    arbFnName,
    arbParams,
    arbReturnType,
  )
  .map(([exported, isAsync, name, params, retType]) => {
    const exp = exported ? 'export ' : '';
    const async_ = isAsync ? 'async ' : '';
    return `${exp}const ${name} = ${async_}(${params})${retType} => {\n  return null;\n}`;
  });

/** Generates a CodeSection with one or more arrow function declarations. */
const arbArrowFnSection: fc.Arbitrary<CodeSection> = fc
  .array(arbArrowFnDecl, { minLength: 1, maxLength: 4 })
  .map((decls) => {
    const content = decls.join('\n\n');
    return {
      filePath: 'src/utils.ts',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
    };
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 6: Function Keyword Usage', () => {
  it(
    'no arrow function patterns remain for named declarations after transform',
    () => {
      fc.assert(
        fc.property(arbArrowFnSection, (section) => {
          const result = functionKeywordRule.transform(section);
          // No `const name = (...) =>` patterns should remain
          expect(result.refined).not.toMatch(
            /const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/,
          );
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'all named declarations use the function keyword after transform',
    () => {
      fc.assert(
        fc.property(arbArrowFnSection, (section) => {
          const result = functionKeywordRule.transform(section);
          // Every function body opener should be preceded by a function keyword declaration
          const fnDeclPattern = /(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(/;
          const lines = result.refined.split('\n');
          for (const line of lines) {
            if (line.includes('=> {')) {
              // Should not happen — arrow patterns should be gone
              expect(line).not.toMatch(/=>\s*\{/);
            }
          }
          // At least one function keyword declaration should exist
          expect(result.refined).toMatch(fnDeclPattern);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects sections containing arrow function declarations',
    () => {
      fc.assert(
        fc.property(arbArrowFnSection, (section) => {
          const violation = functionKeywordRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.standard.function-keyword');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbArrowFnSection, (section) => {
          const result = functionKeywordRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.ruleId).toBe('ts.standard.function-keyword');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 7: Explicit Return Types
//
// For any TypeScript file after refinement, all exported functions and public
// methods must have explicit return type annotations.
//
// Feature: code-simplifier, Property 7: Explicit Return Types
// Validates: Requirements 2.4
// ---------------------------------------------------------------------------

const explicitReturnTypesRule = tsStandardRules.find(
  (r) => r.id === 'ts.standard.explicit-return-types',
)!;

// ---------------------------------------------------------------------------
// Generators for Property 7
// ---------------------------------------------------------------------------

/** Generates an exported function declaration without a return type. */
const arbExportedFnNoReturn: fc.Arbitrary<string> = fc
  .tuple(
    fc.boolean(), // async?
    arbFnName,
    arbParams,
  )
  .map(([isAsync, name, params]) => {
    const async_ = isAsync ? 'async ' : '';
    return `export ${async_}function ${name}(${params}) {\n  return null;\n}`;
  });

/** Generates a CodeSection with one or more exported functions missing return types. */
const arbExportedFnSection: fc.Arbitrary<CodeSection> = fc
  .array(arbExportedFnNoReturn, { minLength: 1, maxLength: 4 })
  .map((decls) => {
    const content = decls.join('\n\n');
    return {
      filePath: 'src/api.ts',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
    };
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 7: Explicit Return Types', () => {
  it(
    'all exported functions have return type annotations after transform',
    () => {
      fc.assert(
        fc.property(arbExportedFnSection, (section) => {
          const result = explicitReturnTypesRule.transform(section);
          // Every exported function declaration should have ): type {
          const exportedFnLines = result.refined
            .split('\n')
            .filter((l) => /^export\s+(?:async\s+)?function\s+\w+/.test(l));

          for (const line of exportedFnLines) {
            // Should have ): <type> { pattern
            expect(line).toMatch(/\)\s*:\s*\S+/);
          }
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'no exported function declarations lack a return type after transform',
    () => {
      fc.assert(
        fc.property(arbExportedFnSection, (section) => {
          const result = explicitReturnTypesRule.transform(section);
          // Should NOT match: export function name(params) { (without : type)
          expect(result.refined).not.toMatch(
            /^export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/m,
          );
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects exported functions without return types',
    () => {
      fc.assert(
        fc.property(arbExportedFnSection, (section) => {
          const violation = explicitReturnTypesRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.standard.explicit-return-types');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbExportedFnSection, (section) => {
          const result = explicitReturnTypesRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.ruleId).toBe('ts.standard.explicit-return-types');
        }),
        { numRuns: 100 },
      );
    },
  );
});


// ---------------------------------------------------------------------------
// Property 8: React Component Pattern
//
// For any React component file after refinement, components must be defined as
// named function declarations (not arrow function expressions).
//
// Feature: code-simplifier, Property 8: React Component Pattern
// Validates: Requirements 2.5, 2.6
// ---------------------------------------------------------------------------

const componentDeclRule = tsStandardRules.find(
  (r) => r.id === 'ts.standard.component-declaration',
)!;

// ---------------------------------------------------------------------------
// Generators for Property 8
// ---------------------------------------------------------------------------

/** Arbitrary for a PascalCase component name. */
const arbComponentName: fc.Arbitrary<string> = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 3,
    maxLength: 8,
  })
  .filter((s) => s.length >= 3)
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

/** Arbitrary for component props parameter. */
const arbPropsParam: fc.Arbitrary<string> = fc.constantFrom(
  '',
  'props: any',
  '{ children }: any',
  '{ title, onClick }: any',
);

/** Generates a React arrow component with PascalCase name. */
const arbArrowComponent: fc.Arbitrary<string> = fc
  .tuple(
    fc.boolean(), // export?
    arbComponentName,
    arbPropsParam,
  )
  .map(([exported, name, params]) => {
    const exp = exported ? 'export ' : '';
    return `${exp}const ${name} = (${params}) => {\n  return <div>${name}</div>;\n}`;
  });

/** Generates a CodeSection with one or more React arrow components. */
const arbComponentSection: fc.Arbitrary<CodeSection> = fc
  .array(arbArrowComponent, { minLength: 1, maxLength: 3 })
  .map((components) => {
    const content = components.join('\n\n');
    return {
      filePath: 'src/components/Example.tsx',
      startLine: 1,
      endLine: content.split('\n').length,
      content,
    };
  });

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 8: React Component Pattern', () => {
  it(
    'arrow components become function declarations after transform',
    () => {
      fc.assert(
        fc.property(arbComponentSection, (section) => {
          const result = componentDeclRule.transform(section);
          // No arrow component patterns should remain for PascalCase names
          expect(result.refined).not.toMatch(
            /const\s+[A-Z]\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/,
          );
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'components use function keyword declarations after transform',
    () => {
      fc.assert(
        fc.property(arbComponentSection, (section) => {
          const result = componentDeclRule.transform(section);
          // Should contain function declarations with PascalCase names
          expect(result.refined).toMatch(/function\s+[A-Z]\w+\s*\(/);
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'match() detects arrow function components',
    () => {
      fc.assert(
        fc.property(arbComponentSection, (section) => {
          const violation = componentDeclRule.match(section);
          expect(violation).not.toBeNull();
          expect(violation!.ruleId).toBe('ts.standard.component-declaration');
        }),
        { numRuns: 100 },
      );
    },
  );

  it(
    'transform preserves metadata',
    () => {
      fc.assert(
        fc.property(arbComponentSection, (section) => {
          const result = componentDeclRule.transform(section);
          expect(result.original).toBe(section.content);
          expect(result.filePath).toBe(section.filePath);
          expect(result.ruleId).toBe('ts.standard.component-declaration');
        }),
        { numRuns: 100 },
      );
    },
  );
});
