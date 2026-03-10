import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultScopeResolver } from '../../../frontend/src/code-simplifier/pipeline/scopeResolver';
import { DefaultFileChangeDetector } from '../../../frontend/src/code-simplifier/pipeline/fileChangeDetector';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

describe('DefaultScopeResolver', () => {
  let detector: DefaultFileChangeDetector;
  let resolver: DefaultScopeResolver;

  beforeEach(() => {
    detector = new DefaultFileChangeDetector();
    resolver = new DefaultScopeResolver(detector);
  });

  // --- Default scope (no explicit paths) ---

  describe('default scope', () => {
    it('returns empty scope when no modified files are provided', () => {
      const result = resolver.resolve([]);
      expect(result.files).toEqual([]);
      expect(result.sections.size).toBe(0);
      expect(result.isExplicit).toBe(false);
    });

    it('includes only the modified files passed in', () => {
      const section: CodeSection = {
        filePath: 'src/app.ts',
        startLine: 1,
        endLine: 10,
        content: 'const x = 1;',
      };
      detector.trackModification('src/app.ts', section);

      const result = resolver.resolve(['src/app.ts']);
      expect(result.files).toEqual(['src/app.ts']);
      expect(result.sections.get('src/app.ts')).toEqual([section]);
      expect(result.isExplicit).toBe(false);
    });

    it('returns modified sections from the detector for each file', () => {
      const s1: CodeSection = { filePath: 'src/a.ts', startLine: 1, endLine: 5, content: 'a' };
      const s2: CodeSection = { filePath: 'src/a.ts', startLine: 20, endLine: 30, content: 'b' };
      detector.trackModification('src/a.ts', s1);
      detector.trackModification('src/a.ts', s2);

      const result = resolver.resolve(['src/a.ts']);
      expect(result.sections.get('src/a.ts')).toEqual([s1, s2]);
    });

    it('handles multiple modified files', () => {
      const sA: CodeSection = { filePath: 'src/a.ts', startLine: 1, endLine: 5, content: 'a' };
      const sB: CodeSection = { filePath: 'src/b.go', startLine: 10, endLine: 20, content: 'b' };
      detector.trackModification('src/a.ts', sA);
      detector.trackModification('src/b.go', sB);

      const result = resolver.resolve(['src/a.ts', 'src/b.go']);
      expect(result.files).toEqual(['src/a.ts', 'src/b.go']);
      expect(result.sections.get('src/a.ts')).toEqual([sA]);
      expect(result.sections.get('src/b.go')).toEqual([sB]);
    });

    it('returns empty sections for a file with no tracked modifications', () => {
      const result = resolver.resolve(['src/untracked.ts']);
      expect(result.files).toEqual(['src/untracked.ts']);
      expect(result.sections.get('src/untracked.ts')).toEqual([]);
    });

    it('does not include files not in the modifiedFiles list', () => {
      const section: CodeSection = { filePath: 'src/other.ts', startLine: 1, endLine: 5, content: '' };
      detector.trackModification('src/other.ts', section);

      const result = resolver.resolve(['src/app.ts']);
      expect(result.files).toEqual(['src/app.ts']);
      expect(result.sections.has('src/other.ts')).toBe(false);
    });
  });

  // --- Explicit scope ---

  describe('explicit scope', () => {
    it('returns exactly the specified paths', () => {
      const result = resolver.resolve([], ['src/target.ts', 'src/utils/']);
      expect(result.files).toEqual(['src/target.ts', 'src/utils/']);
      expect(result.isExplicit).toBe(true);
    });

    it('creates full-file CodeSections for each explicit path', () => {
      const result = resolver.resolve([], ['src/target.ts']);
      const sections = result.sections.get('src/target.ts');
      expect(sections).toHaveLength(1);
      expect(sections![0]).toEqual({
        filePath: 'src/target.ts',
        startLine: 1,
        endLine: Number.MAX_SAFE_INTEGER,
        content: '',
      });
    });

    it('ignores modifiedFiles when explicit scope is provided', () => {
      const section: CodeSection = { filePath: 'src/modified.ts', startLine: 1, endLine: 5, content: '' };
      detector.trackModification('src/modified.ts', section);

      const result = resolver.resolve(['src/modified.ts'], ['src/explicit.ts']);
      expect(result.files).toEqual(['src/explicit.ts']);
      expect(result.sections.has('src/modified.ts')).toBe(false);
    });

    it('does not include files outside the explicit scope', () => {
      detector.trackModification('src/a.ts', { filePath: 'src/a.ts', startLine: 1, endLine: 5, content: '' });
      detector.trackModification('src/b.ts', { filePath: 'src/b.ts', startLine: 1, endLine: 5, content: '' });

      const result = resolver.resolve(['src/a.ts', 'src/b.ts'], ['src/c.ts']);
      expect(result.files).toEqual(['src/c.ts']);
      expect(result.sections.has('src/a.ts')).toBe(false);
      expect(result.sections.has('src/b.ts')).toBe(false);
    });

    it('treats empty explicit scope array as default scope', () => {
      const section: CodeSection = { filePath: 'src/app.ts', startLine: 1, endLine: 10, content: 'code' };
      detector.trackModification('src/app.ts', section);

      const result = resolver.resolve(['src/app.ts'], []);
      expect(result.isExplicit).toBe(false);
      expect(result.files).toEqual(['src/app.ts']);
    });
  });
});
