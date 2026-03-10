import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultFileChangeDetector } from '../../../frontend/src/code-simplifier/pipeline/fileChangeDetector';
import type { CodeSection } from '../../../frontend/src/code-simplifier/types';

describe('DefaultFileChangeDetector', () => {
  let detector: DefaultFileChangeDetector;

  beforeEach(() => {
    detector = new DefaultFileChangeDetector();
  });

  // --- getModifiedFiles ---

  it('returns an empty array when no files have been tracked', () => {
    expect(detector.getModifiedFiles()).toEqual([]);
  });

  it('returns tracked file paths after modifications are registered', () => {
    const section: CodeSection = {
      filePath: 'src/app.ts',
      startLine: 1,
      endLine: 10,
      content: 'const x = 1;',
    };
    detector.trackModification('src/app.ts', section);
    expect(detector.getModifiedFiles()).toEqual(['src/app.ts']);
  });

  it('returns each file path only once even with multiple sections', () => {
    const s1: CodeSection = { filePath: 'src/a.ts', startLine: 1, endLine: 5, content: '' };
    const s2: CodeSection = { filePath: 'src/a.ts', startLine: 10, endLine: 15, content: '' };
    detector.trackModification('src/a.ts', s1);
    detector.trackModification('src/a.ts', s2);
    expect(detector.getModifiedFiles()).toEqual(['src/a.ts']);
  });

  it('tracks multiple distinct files', () => {
    detector.trackModification('src/a.ts', { filePath: 'src/a.ts', startLine: 1, endLine: 2, content: '' });
    detector.trackModification('src/b.go', { filePath: 'src/b.go', startLine: 1, endLine: 2, content: '' });
    expect(detector.getModifiedFiles()).toEqual(expect.arrayContaining(['src/a.ts', 'src/b.go']));
    expect(detector.getModifiedFiles()).toHaveLength(2);
  });

  // --- getModifiedSections ---

  it('returns an empty array for an untracked file', () => {
    expect(detector.getModifiedSections('nonexistent.ts')).toEqual([]);
  });

  it('returns the tracked sections for a file', () => {
    const section: CodeSection = { filePath: 'src/a.ts', startLine: 5, endLine: 15, content: 'code' };
    detector.trackModification('src/a.ts', section);
    expect(detector.getModifiedSections('src/a.ts')).toEqual([section]);
  });

  it('accumulates multiple sections for the same file', () => {
    const s1: CodeSection = { filePath: 'src/a.ts', startLine: 1, endLine: 5, content: 'a' };
    const s2: CodeSection = { filePath: 'src/a.ts', startLine: 20, endLine: 30, content: 'b' };
    detector.trackModification('src/a.ts', s1);
    detector.trackModification('src/a.ts', s2);
    expect(detector.getModifiedSections('src/a.ts')).toEqual([s1, s2]);
  });

  // --- clear ---

  it('removes all tracked modifications on clear', () => {
    detector.trackModification('src/a.ts', { filePath: 'src/a.ts', startLine: 1, endLine: 2, content: '' });
    detector.clear();
    expect(detector.getModifiedFiles()).toEqual([]);
    expect(detector.getModifiedSections('src/a.ts')).toEqual([]);
  });
});
