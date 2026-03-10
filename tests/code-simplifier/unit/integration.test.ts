import { describe, it, expect } from 'vitest';
import {
  createRefinementPipeline,
  DefaultFileChangeDetector,
  type CodeSection,
  type Transformation,
} from '../../../frontend/src/code-simplifier';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function section(filePath: string, content: string, startLine = 1, endLine = 10): CodeSection {
  return { filePath, startLine, endLine, content };
}

// ---------------------------------------------------------------------------
// 1. TypeScript end-to-end: require() → ES module violation
//    Validates: Requirements 1.1, 2.1
// ---------------------------------------------------------------------------

describe('Integration: TypeScript end-to-end', () => {
  it('detects es-module violation for require() and produces transformation', () => {
    const detector = new DefaultFileChangeDetector();
    const tsContent = `const lodash = require("lodash");\nconst path = require("path");\n`;

    detector.trackModification('src/utils.ts', section('src/utils.ts', tsContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);

    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];
    const esModuleHit = allTransformations.some((t) => t.ruleId === 'ts.standard.es-modules');
    expect(esModuleHit).toBe(true);

    // The applied transformation should convert require → import
    const applied = report.transformationsApplied.find(
      (t) => t.ruleId === 'ts.standard.es-modules',
    );
    if (applied) {
      expect(applied.refined).toContain('import');
      expect(applied.refined).not.toContain('require');
    }
  });

  it('detects import-sort violation for unsorted imports', () => {
    const detector = new DefaultFileChangeDetector();
    const tsContent = [
      `import { helper } from './helper';`,
      `import React from 'react';`,
      `import { config } from '@/config';`,
      '',
      'export function App() { return null; }',
    ].join('\n');

    detector.trackModification('src/App.ts', section('src/App.ts', tsContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);

    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];
    const importSortHit = allTransformations.some((t) => t.ruleId === 'ts.standard.import-sort');
    expect(importSortHit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Go end-to-end: unchecked error → error-handling violation
//    Validates: Requirements 1.1, 3.1
// ---------------------------------------------------------------------------

describe('Integration: Go end-to-end', () => {
  it('detects error-handling violation for unchecked error', () => {
    const detector = new DefaultFileChangeDetector();
    const goContent = [
      'package main',
      '',
      'import "os"',
      '',
      'func main() {',
      '\tfile, _ := os.Open("data.txt")',
      '\tfmt.Println(file)',
      '}',
    ].join('\n');

    detector.trackModification('backend/main.go', section('backend/main.go', goContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);

    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];
    const errorHandlingHit = allTransformations.some(
      (t) => t.ruleId === 'go.standard.error-handling',
    );
    expect(errorHandlingHit).toBe(true);
  });

  it('detects naming violation for snake_case identifiers', () => {
    const detector = new DefaultFileChangeDetector();
    const goContent = [
      'package handlers',
      '',
      'func handle_request() {',
      '\tvar user_name string',
      '}',
    ].join('\n');

    detector.trackModification('backend/handlers.go', section('backend/handlers.go', goContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);

    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];
    const namingHit = allTransformations.some((t) => t.ruleId === 'go.standard.naming');
    expect(namingHit).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Rollback on post-validation failure
//    Validates: Requirements 8.4
// ---------------------------------------------------------------------------

describe('Integration: Rollback on post-validation failure', () => {
  it('moves all transformations to discarded when postValidator returns false', () => {
    const detector = new DefaultFileChangeDetector();
    // Use unsorted imports — the import-sort transformation is safe (same imports, just reordered)
    const tsContent = [
      `import { helper } from './helper';`,
      `import React from 'react';`,
      '',
      'const x = 1;',
    ].join('\n');

    detector.trackModification('src/broken.ts', section('src/broken.ts', tsContent));

    const rolledBack: Array<{ filePath: string; originals: Transformation[] }> = [];

    const pipeline = createRefinementPipeline({
      fileChangeDetector: detector,
      postValidator: () => false,
      applyTransformation: () => true,
      rollbackTransformations: (filePath, originals) => {
        rolledBack.push({ filePath, originals });
      },
    });

    const report = pipeline.run();

    // All transformations should be discarded (none applied)
    expect(report.transformationsApplied).toHaveLength(0);
    expect(report.transformationsDiscarded.length).toBeGreaterThan(0);

    // Rollback callback should have been invoked for the file
    expect(rolledBack.length).toBeGreaterThan(0);
    expect(rolledBack[0].filePath).toBe('src/broken.ts');

    // Errors should mention post-validation failure
    const hasRollbackError = report.errors.some((e) => e.includes('Post-validation failed'));
    expect(hasRollbackError).toBe(true);
  });

  it('rollback callback receives the transformations that were applied', () => {
    const detector = new DefaultFileChangeDetector();
    // Use unsorted imports — the import-sort transformation is safe
    const tsContent = [
      `import { helper } from './helper';`,
      `import React from 'react';`,
      '',
      'const x = 1;',
    ].join('\n');

    detector.trackModification('src/fail.ts', section('src/fail.ts', tsContent));

    let rolledBackTransformations: Transformation[] = [];

    const pipeline = createRefinementPipeline({
      fileChangeDetector: detector,
      postValidator: () => false,
      applyTransformation: () => true,
      rollbackTransformations: (_filePath, originals) => {
        rolledBackTransformations = originals;
      },
    });

    pipeline.run();

    // The rolled-back transformations should have the correct file path
    expect(rolledBackTransformations.length).toBeGreaterThan(0);
    for (const t of rolledBackTransformations) {
      expect(t.filePath).toBe('src/fail.ts');
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Scope containment across multiple files
//    Validates: Requirements 6.1
// ---------------------------------------------------------------------------

describe('Integration: Scope containment', () => {
  it('only analyzes files within explicit scope', () => {
    const detector = new DefaultFileChangeDetector();

    // Track two files
    const tsContent = `const x = require("fs");\n`;
    const goContent = `func handle_request() {}\n`;

    detector.trackModification('src/a.ts', section('src/a.ts', tsContent));
    detector.trackModification('backend/b.go', section('backend/b.go', goContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });

    // Run with explicit scope limited to only the TS file
    const report = pipeline.run(['src/a.ts']);

    // Only the scoped file should be analyzed
    expect(report.filesAnalyzed).toBe(1);

    // All transformations should reference only the scoped file
    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];
    for (const t of allTransformations) {
      expect(t.filePath).toBe('src/a.ts');
    }
  });

  it('default scope processes all tracked modified files', () => {
    const detector = new DefaultFileChangeDetector();

    const tsContent = `const x = require("fs");\n`;
    const goContent = [
      'package main',
      '',
      'func handle_request() {}',
    ].join('\n');

    detector.trackModification('src/a.ts', section('src/a.ts', tsContent));
    detector.trackModification('backend/b.go', section('backend/b.go', goContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });

    // Run with default scope (no explicit scope)
    const report = pipeline.run();

    // Both files should be analyzed
    expect(report.filesAnalyzed).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 5. Multiple files: both TS and Go processed independently
//    Validates: Requirements 1.1, 2.1, 3.1
// ---------------------------------------------------------------------------

describe('Integration: Multiple files processed independently', () => {
  it('processes both TypeScript and Go files in a single run', () => {
    const detector = new DefaultFileChangeDetector();

    const tsContent = `const lodash = require("lodash");\nexport function greet() { return "hi"; }\n`;
    const goContent = [
      'package main',
      '',
      'import "os"',
      '',
      'func main() {',
      '\tfile, _ := os.Open("data.txt")',
      '\tfmt.Println(file)',
      '}',
    ].join('\n');

    detector.trackModification('src/utils.ts', section('src/utils.ts', tsContent));
    detector.trackModification('backend/main.go', section('backend/main.go', goContent));

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(2);

    const allTransformations = [
      ...report.transformationsApplied,
      ...report.transformationsDiscarded,
    ];

    // Should have transformations from both files
    const tsTransformations = allTransformations.filter((t) => t.filePath === 'src/utils.ts');
    const goTransformations = allTransformations.filter((t) => t.filePath === 'backend/main.go');

    expect(tsTransformations.length).toBeGreaterThan(0);
    expect(goTransformations.length).toBeGreaterThan(0);
  });

  it('rollback for one file does not affect the other', () => {
    const detector = new DefaultFileChangeDetector();

    // TS file with unsorted imports (safe transformation)
    const tsContent = [
      `import { helper } from './helper';`,
      `import React from 'react';`,
      '',
      'const x = 1;',
    ].join('\n');
    // Go file with ungrouped imports (safe transformation — just reordering)
    const goContent = [
      'package main',
      '',
      'import (',
      '\t"github.com/gin-gonic/gin"',
      '\t"fmt"',
      '\t"net/http"',
      ')',
      '',
      'func main() {',
      '\tfmt.Println("hello")',
      '}',
    ].join('\n');

    detector.trackModification('src/utils.ts', section('src/utils.ts', tsContent));
    detector.trackModification('backend/main.go', section('backend/main.go', goContent));

    // Post-validator fails only for the TS file
    const pipeline = createRefinementPipeline({
      fileChangeDetector: detector,
      postValidator: (filePath) => filePath !== 'src/utils.ts',
      applyTransformation: () => true,
      rollbackTransformations: () => {},
    });

    const report = pipeline.run();

    // TS transformations should be discarded (post-validation failed)
    const discardedTs = report.transformationsDiscarded.filter(
      (t) => t.filePath === 'src/utils.ts',
    );
    // Go transformations should be applied (post-validation passed)
    const appliedGo = report.transformationsApplied.filter(
      (t) => t.filePath === 'backend/main.go',
    );

    // TS file had violations, so discarded should have entries
    expect(discardedTs.length).toBeGreaterThan(0);
    // Go file had violations and passed validation, so applied should have entries
    expect(appliedGo.length).toBeGreaterThan(0);
  });
});
