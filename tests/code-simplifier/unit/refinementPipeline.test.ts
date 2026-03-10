import { describe, it, expect, vi } from 'vitest';
import {
  DefaultRefinementPipeline,
  type PostValidator,
  type TransformationApplier,
  type TransformationRollback,
} from '../../../frontend/src/code-simplifier/pipeline/refinementPipeline';
import type {
  FileChangeDetector,
  ScopeResolver,
  LanguageRouter,
  LanguageAnalyzer,
  RuleEngine,
  BehaviorPreservationValidator,
  CodeSection,
  ScopeResult,
  RuleViolation,
  Transformation,
  ValidationResult,
} from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSection(filePath: string, content = 'const x = 1;', startLine = 1, endLine = 1): CodeSection {
  return { filePath, startLine, endLine, content };
}

function makeViolation(ruleId: string, section: CodeSection, severity: 'standard' | 'clarity' = 'standard'): RuleViolation {
  return {
    ruleId,
    severity,
    location: section,
    description: `Violation: ${ruleId}`,
    suggestedFix: {
      ruleId,
      filePath: section.filePath,
      original: section.content,
      refined: `refined(${section.content})`,
      startLine: section.startLine,
      endLine: section.endLine,
    },
  };
}

function makeTransformation(ruleId: string, filePath: string): Transformation {
  return {
    ruleId,
    filePath,
    original: 'original',
    refined: 'refined',
    startLine: 1,
    endLine: 5,
  };
}

/** Create a minimal set of mock dependencies. */
function createMocks(overrides: {
  modifiedFiles?: string[];
  sections?: Map<string, CodeSection[]>;
  analyzerResult?: RuleViolation[];
  routeReturnsNull?: boolean;
  matchRulesResult?: Transformation[];
  validationResult?: ValidationResult;
  postValidator?: PostValidator;
  applyTransformation?: TransformationApplier;
  rollbackTransformations?: TransformationRollback;
  scopeResolverThrows?: boolean;
  fileChangeDetectorThrows?: boolean;
  analyzerThrows?: boolean;
  validatorThrows?: boolean;
} = {}) {
  const section = makeSection('src/test.ts', 'const x = 1;');
  const defaultSections = new Map<string, CodeSection[]>();
  defaultSections.set('src/test.ts', [section]);

  const modifiedFiles = overrides.modifiedFiles ?? ['src/test.ts'];
  const sections = overrides.sections ?? defaultSections;

  const fileChangeDetector: FileChangeDetector = {
    getModifiedFiles: overrides.fileChangeDetectorThrows
      ? () => { throw new Error('detector error'); }
      : () => modifiedFiles,
    getModifiedSections: (fp: string) => sections.get(fp) ?? [],
  };

  const scopeResolver: ScopeResolver = {
    resolve: overrides.scopeResolverThrows
      ? () => { throw new Error('scope error'); }
      : (_mf: string[], explicit?: string[]) => {
          const files = explicit && explicit.length > 0 ? explicit : modifiedFiles;
          const resultSections = new Map<string, CodeSection[]>();
          for (const f of files) {
            resultSections.set(f, sections.get(f) ?? []);
          }
          return { files, sections: resultSections, isExplicit: !!(explicit && explicit.length > 0) };
        },
  };

  const violation = makeViolation('ts.standard.es-modules', section);
  const analyzerViolations = overrides.analyzerResult ?? [violation];

  const tsAnalyzer: LanguageAnalyzer = {
    language: 'typescript',
    analyze: overrides.analyzerThrows
      ? () => { throw new Error('parse error'); }
      : () => analyzerViolations,
  };

  const languageRouter: LanguageRouter = {
    route: (fp: string) => {
      if (overrides.routeReturnsNull) return null;
      if (fp.endsWith('.ts') || fp.endsWith('.tsx')) return tsAnalyzer;
      if (fp.endsWith('.go')) return { language: 'go', analyze: () => analyzerViolations } as LanguageAnalyzer;
      return null;
    },
  };

  const defaultTransformations = overrides.matchRulesResult ?? analyzerViolations.map((v) => v.suggestedFix);

  const ruleEngine: RuleEngine = {
    matchRules: () => defaultTransformations,
    getPrioritizedRules: () => [],
  };

  const behaviorValidator: BehaviorPreservationValidator = {
    validate: overrides.validatorThrows
      ? () => { throw new Error('validation error'); }
      : () => overrides.validationResult ?? { safe: true },
  };

  return {
    fileChangeDetector,
    scopeResolver,
    languageRouter,
    ruleEngine,
    behaviorValidator,
    postValidator: overrides.postValidator,
    applyTransformation: overrides.applyTransformation,
    rollbackTransformations: overrides.rollbackTransformations,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DefaultRefinementPipeline', () => {
  describe('basic pipeline flow', () => {
    it('processes modified files and returns applied transformations', () => {
      const mocks = createMocks();
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(1);
      expect(report.transformationsApplied).toHaveLength(1);
      expect(report.transformationsDiscarded).toHaveLength(0);
      expect(report.errors).toHaveLength(0);
    });

    it('returns empty report when no files are modified', () => {
      const mocks = createMocks({ modifiedFiles: [], sections: new Map() });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(0);
      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.errors).toHaveLength(0);
    });

    it('uses explicit scope when provided', () => {
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/explicit.ts', [makeSection('src/explicit.ts')]);
      const mocks = createMocks({ modifiedFiles: ['src/other.ts'], sections });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run(['src/explicit.ts']);

      expect(report.filesAnalyzed).toBe(1);
      expect(report.transformationsApplied).toHaveLength(1);
    });

    it('processes multiple sections in a single file in one pass', () => {
      const sections = new Map<string, CodeSection[]>();
      const s1 = makeSection('src/test.ts', 'const a = 1;', 1, 5);
      const s2 = makeSection('src/test.ts', 'const b = 2;', 10, 15);
      sections.set('src/test.ts', [s1, s2]);
      const mocks = createMocks({ sections });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(1);
      // One transformation per section (each section produces one violation)
      expect(report.transformationsApplied).toHaveLength(2);
    });

    it('processes multiple files independently', () => {
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/a.ts', [makeSection('src/a.ts')]);
      sections.set('src/b.ts', [makeSection('src/b.ts')]);
      const mocks = createMocks({ modifiedFiles: ['src/a.ts', 'src/b.ts'], sections });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(2);
      expect(report.transformationsApplied).toHaveLength(2);
    });
  });

  describe('language routing', () => {
    it('skips unsupported file types silently', () => {
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/readme.md', [makeSection('src/readme.md')]);
      const mocks = createMocks({ modifiedFiles: ['src/readme.md'], sections });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(0);
      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.errors).toHaveLength(0);
    });

    it('skips files when router returns null', () => {
      const mocks = createMocks({ routeReturnsNull: true });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(0);
      expect(report.errors).toHaveLength(0);
    });
  });

  describe('behavior validation', () => {
    it('discards unsafe transformations', () => {
      const mocks = createMocks({ validationResult: { safe: false, reason: 'API changed' } });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
    });

    it('applies safe transformations', () => {
      const mocks = createMocks({ validationResult: { safe: true } });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(1);
      expect(report.transformationsDiscarded).toHaveLength(0);
    });
  });

  describe('post-validation and rollback', () => {
    it('keeps transformations when post-validation passes', () => {
      const mocks = createMocks({ postValidator: () => true });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(1);
      expect(report.errors).toHaveLength(0);
    });

    it('rolls back file transformations when post-validation fails', () => {
      const rollbackFn = vi.fn();
      const mocks = createMocks({
        postValidator: () => false,
        rollbackTransformations: rollbackFn,
      });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.errors.some((e) => e.includes('Post-validation failed'))).toBe(true);
      expect(rollbackFn).toHaveBeenCalledTimes(1);
    });

    it('performs per-file rollback, not global', () => {
      const goodSection = makeSection('src/good.ts', 'good code');
      const badSection = makeSection('src/bad.ts', 'bad code');
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/good.ts', [goodSection]);
      sections.set('src/bad.ts', [badSection]);
      const rollbackFn = vi.fn();
      const mocks = createMocks({
        modifiedFiles: ['src/good.ts', 'src/bad.ts'],
        sections,
        postValidator: (fp: string) => fp !== 'src/bad.ts',
        rollbackTransformations: rollbackFn,
      });
      // Override analyzer and rule engine to produce file-specific transformations
      mocks.languageRouter.route = (fp: string) => {
        if (!fp.endsWith('.ts')) return null;
        return {
          language: 'typescript' as const,
          analyze: (section: CodeSection) => [makeViolation('ts.standard.es-modules', section)],
        };
      };
      mocks.ruleEngine.matchRules = (violations) => violations.map((v) => v.suggestedFix);
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      // good.ts passes post-validation, bad.ts fails
      expect(report.transformationsApplied).toHaveLength(1);
      expect(report.transformationsApplied[0].filePath).toBe('src/good.ts');
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.transformationsDiscarded[0].filePath).toBe('src/bad.ts');
      expect(rollbackFn).toHaveBeenCalledTimes(1);
      expect(rollbackFn.mock.calls[0][0]).toBe('src/bad.ts');
    });

    it('handles post-validation throwing an error', () => {
      const rollbackFn = vi.fn();
      const mocks = createMocks({
        postValidator: () => { throw new Error('type check crashed'); },
        rollbackTransformations: rollbackFn,
      });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.errors.some((e) => e.includes('type check crashed'))).toBe(true);
      expect(rollbackFn).toHaveBeenCalledTimes(1);
    });

    it('skips post-validation when no postValidator is provided', () => {
      const mocks = createMocks(); // no postValidator
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(1);
    });
  });

  describe('transformation application', () => {
    it('calls applyTransformation for safe transformations', () => {
      const applyFn = vi.fn().mockReturnValue(true);
      const mocks = createMocks({ applyTransformation: applyFn });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(applyFn).toHaveBeenCalledTimes(1);
      expect(report.transformationsApplied).toHaveLength(1);
    });

    it('discards transformation when applyTransformation returns false', () => {
      const applyFn = vi.fn().mockReturnValue(false);
      const mocks = createMocks({ applyTransformation: applyFn });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.errors.some((e) => e.includes('Failed to apply'))).toBe(true);
    });

    it('discards transformation when applyTransformation throws', () => {
      const applyFn = vi.fn().mockImplementation(() => { throw new Error('write failed'); });
      const mocks = createMocks({ applyTransformation: applyFn });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.errors.some((e) => e.includes('write failed'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('logs error and returns empty report when file change detection fails', () => {
      const mocks = createMocks({ fileChangeDetectorThrows: true });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(0);
      expect(report.errors.some((e) => e.includes('detector error'))).toBe(true);
    });

    it('logs error and returns empty report when scope resolution fails', () => {
      const mocks = createMocks({ scopeResolverThrows: true });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(0);
      expect(report.errors.some((e) => e.includes('scope error'))).toBe(true);
    });

    it('skips section on analyzer parse failure and continues', () => {
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/test.ts', [
        makeSection('src/test.ts', 'bad code', 1, 5),
        makeSection('src/test.ts', 'good code', 10, 15),
      ]);
      // Analyzer throws on first call, succeeds on second
      let callCount = 0;
      const mocks = createMocks({ sections });
      // Override the analyzer to throw on first section
      const originalRoute = mocks.languageRouter.route;
      mocks.languageRouter.route = (fp: string) => {
        const analyzer = originalRoute(fp);
        if (!analyzer) return null;
        return {
          language: analyzer.language,
          analyze: (section: CodeSection) => {
            callCount++;
            if (callCount === 1) throw new Error('parse error');
            return [makeViolation('ts.standard.es-modules', section)];
          },
        };
      };
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.errors.some((e) => e.includes('parse error'))).toBe(true);
      expect(report.transformationsApplied).toHaveLength(1);
    });

    it('discards transformation when validator throws', () => {
      const mocks = createMocks({ validatorThrows: true });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.transformationsApplied).toHaveLength(0);
      expect(report.transformationsDiscarded).toHaveLength(1);
      expect(report.errors.some((e) => e.includes('validation error'))).toBe(true);
    });

    it('skips file with no sections', () => {
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/empty.ts', []);
      const mocks = createMocks({ modifiedFiles: ['src/empty.ts'], sections });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(1);
      expect(report.transformationsApplied).toHaveLength(0);
    });

    it('skips file with no violations', () => {
      const mocks = createMocks({ analyzerResult: [] });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.filesAnalyzed).toBe(1);
      expect(report.transformationsApplied).toHaveLength(0);
    });

    it('handles rollback failure gracefully', () => {
      const rollbackFn = vi.fn().mockImplementation(() => { throw new Error('rollback failed'); });
      const mocks = createMocks({
        postValidator: () => false,
        rollbackTransformations: rollbackFn,
      });
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report.errors.some((e) => e.includes('rollback failed'))).toBe(true);
      expect(report.errors.some((e) => e.includes('Post-validation failed'))).toBe(true);
    });
  });

  describe('report generation', () => {
    it('generates complete RefinementReport with all fields', () => {
      const mocks = createMocks();
      const pipeline = new DefaultRefinementPipeline(mocks);

      const report = pipeline.run();

      expect(report).toHaveProperty('filesAnalyzed');
      expect(report).toHaveProperty('transformationsApplied');
      expect(report).toHaveProperty('transformationsDiscarded');
      expect(report).toHaveProperty('errors');
      expect(typeof report.filesAnalyzed).toBe('number');
      expect(Array.isArray(report.transformationsApplied)).toBe(true);
      expect(Array.isArray(report.transformationsDiscarded)).toBe(true);
      expect(Array.isArray(report.errors)).toBe(true);
    });

    it('includes both applied and discarded transformations in report', () => {
      const section1 = makeSection('src/test.ts', 'code1', 1, 5);
      const section2 = makeSection('src/test.ts', 'code2', 10, 15);
      const v1 = makeViolation('ts.standard.es-modules', section1);
      const v2 = makeViolation('ts.clarity.guard-clauses', section2);
      const sections = new Map<string, CodeSection[]>();
      sections.set('src/test.ts', [section1, section2]);

      // Validator alternates safe/unsafe
      let validateCallCount = 0;
      const mocks = createMocks({
        sections,
        analyzerResult: [v1],
        matchRulesResult: [v1.suggestedFix],
      });
      mocks.behaviorValidator.validate = () => {
        validateCallCount++;
        return validateCallCount % 2 === 1 ? { safe: true } : { safe: false, reason: 'unsafe' };
      };
      // Override analyzer to return different violations per section
      mocks.languageRouter.route = () => ({
        language: 'typescript' as const,
        analyze: () => [v1],
      });
      // Override ruleEngine to return one transformation per call
      mocks.ruleEngine.matchRules = (violations) => violations.map((v) => v.suggestedFix);

      const pipeline = new DefaultRefinementPipeline(mocks);
      const report = pipeline.run();

      expect(report.transformationsApplied.length + report.transformationsDiscarded.length).toBe(2);
    });
  });
});
