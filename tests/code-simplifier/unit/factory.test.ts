import { describe, it, expect } from 'vitest';
import {
  createRefinementPipeline,
  DefaultFileChangeDetector,
  DefaultRefinementPipeline,
} from '../../../frontend/src/code-simplifier';

describe('createRefinementPipeline', () => {
  it('returns a DefaultRefinementPipeline instance', () => {
    const detector = new DefaultFileChangeDetector();
    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    expect(pipeline).toBeInstanceOf(DefaultRefinementPipeline);
  });

  it('produces a working pipeline that returns a RefinementReport', () => {
    const detector = new DefaultFileChangeDetector();
    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });

    // No modifications tracked → empty report
    const report = pipeline.run();
    expect(report).toEqual({
      filesAnalyzed: 0,
      transformationsApplied: [],
      transformationsDiscarded: [],
      errors: [],
    });
  });

  it('processes a tracked TypeScript file through the full pipeline', () => {
    const detector = new DefaultFileChangeDetector();
    detector.trackModification('src/example.ts', {
      filePath: 'src/example.ts',
      startLine: 1,
      endLine: 3,
      content: 'const x = require("lodash");\n',
    });

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);
    // The es-modules rule should fire on the require() call
    expect(
      report.transformationsApplied.length + report.transformationsDiscarded.length,
    ).toBeGreaterThan(0);
  });

  it('processes a tracked Go file through the full pipeline', () => {
    const detector = new DefaultFileChangeDetector();
    detector.trackModification('backend/handler.go', {
      filePath: 'backend/handler.go',
      startLine: 1,
      endLine: 5,
      content: 'val, _ := os.Open("file")\nfmt.Println(val)\n',
    });

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(1);
  });

  it('accepts optional callbacks', () => {
    const detector = new DefaultFileChangeDetector();
    const applied: string[] = [];

    const pipeline = createRefinementPipeline({
      fileChangeDetector: detector,
      postValidator: () => true,
      applyTransformation: (t) => { applied.push(t.ruleId); return true; },
      rollbackTransformations: () => {},
    });

    expect(pipeline).toBeInstanceOf(DefaultRefinementPipeline);
  });

  it('skips unsupported file extensions silently', () => {
    const detector = new DefaultFileChangeDetector();
    detector.trackModification('readme.md', {
      filePath: 'readme.md',
      startLine: 1,
      endLine: 1,
      content: '# Hello',
    });

    const pipeline = createRefinementPipeline({ fileChangeDetector: detector });
    const report = pipeline.run();

    expect(report.filesAnalyzed).toBe(0);
    expect(report.errors).toHaveLength(0);
  });
});
