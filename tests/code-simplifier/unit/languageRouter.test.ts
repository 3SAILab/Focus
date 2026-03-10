import { describe, it, expect } from 'vitest';
import { DefaultLanguageRouter } from '../../../frontend/src/code-simplifier/pipeline/languageRouter';
import type { LanguageAnalyzer, CodeSection, RuleViolation } from '../../../frontend/src/code-simplifier/types';

/** Minimal stub analyzer for testing routing logic. */
function stubAnalyzer(lang: 'typescript' | 'go'): LanguageAnalyzer {
  return {
    language: lang,
    analyze(_section: CodeSection): RuleViolation[] {
      return [];
    },
  };
}

describe('DefaultLanguageRouter', () => {
  const tsAnalyzer = stubAnalyzer('typescript');
  const goAnalyzer = stubAnalyzer('go');

  const analyzers = new Map<'typescript' | 'go', LanguageAnalyzer>([
    ['typescript', tsAnalyzer],
    ['go', goAnalyzer],
  ]);

  const router = new DefaultLanguageRouter(analyzers);

  // --- TypeScript routing ---

  it('routes .ts files to the TypeScript analyzer', () => {
    expect(router.route('src/app.ts')).toBe(tsAnalyzer);
  });

  it('routes .tsx files to the TypeScript analyzer', () => {
    expect(router.route('src/components/Button.tsx')).toBe(tsAnalyzer);
  });

  it('routes compound .test.ts extensions to the TypeScript analyzer', () => {
    expect(router.route('src/utils/helpers.test.ts')).toBe(tsAnalyzer);
  });

  // --- Go routing ---

  it('routes .go files to the Go analyzer', () => {
    expect(router.route('backend/main.go')).toBe(goAnalyzer);
  });

  it('routes nested .go files to the Go analyzer', () => {
    expect(router.route('backend/handlers/generate.go')).toBe(goAnalyzer);
  });

  // --- Unsupported extensions (skip silently) ---

  it('returns null for .js files', () => {
    expect(router.route('src/legacy.js')).toBeNull();
  });

  it('returns null for .py files', () => {
    expect(router.route('scripts/build.py')).toBeNull();
  });

  it('returns null for .json files', () => {
    expect(router.route('package.json')).toBeNull();
  });

  it('returns null for .css files', () => {
    expect(router.route('src/styles/app.css')).toBeNull();
  });

  it('returns null for files with no extension', () => {
    expect(router.route('Makefile')).toBeNull();
  });

  it('returns null for dotfiles', () => {
    expect(router.route('.gitignore')).toBeNull();
  });

  // --- Case insensitivity ---

  it('handles uppercase extensions', () => {
    expect(router.route('src/App.TS')).toBe(tsAnalyzer);
  });

  it('handles mixed-case .Go extension', () => {
    expect(router.route('backend/Main.Go')).toBe(goAnalyzer);
  });

  // --- Edge cases ---

  it('returns null when analyzer map is empty', () => {
    const emptyRouter = new DefaultLanguageRouter(new Map());
    expect(emptyRouter.route('src/app.ts')).toBeNull();
  });

  it('returns null when the language has no registered analyzer', () => {
    const tsOnlyRouter = new DefaultLanguageRouter(
      new Map([['typescript', tsAnalyzer]])
    );
    expect(tsOnlyRouter.route('backend/main.go')).toBeNull();
  });
});
