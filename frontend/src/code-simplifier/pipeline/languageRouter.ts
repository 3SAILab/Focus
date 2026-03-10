import type { LanguageRouter, LanguageAnalyzer, SupportedLanguage } from '../types';

/**
 * Maps file extensions to their corresponding {@link SupportedLanguage}.
 */
const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.go': 'go',
};

/**
 * Default implementation of {@link LanguageRouter}.
 *
 * Routes files to the correct language-specific analyzer based on file
 * extension.  Unsupported extensions are silently skipped (returns `null`).
 */
export class DefaultLanguageRouter implements LanguageRouter {
  private readonly analyzers: Map<SupportedLanguage, LanguageAnalyzer>;

  constructor(analyzers: Map<SupportedLanguage, LanguageAnalyzer>) {
    this.analyzers = analyzers;
  }

  route(filePath: string): LanguageAnalyzer | null {
    const ext = extractExtension(filePath);
    const language = EXTENSION_MAP[ext];
    if (!language) {
      return null;
    }
    return this.analyzers.get(language) ?? null;
  }
}

/**
 * Extract the file extension (including the leading dot) from a path.
 * Handles compound extensions like `.test.ts` by returning only the last
 * segment (`.ts`).
 */
function extractExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filePath.slice(lastDot).toLowerCase();
}
