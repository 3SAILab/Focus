import type { ScopeResolver, ScopeResult, CodeSection, FileChangeDetector } from '../types';

/**
 * Default implementation of {@link ScopeResolver}.
 *
 * Determines which files and sections fall within the refinement scope:
 * - Default scope (no explicit paths): only recently modified files and their
 *   modified sections are included (Req 6.1, 6.4).
 * - Explicit scope: exactly the specified file/directory paths are included,
 *   with full-file CodeSections created for each (Req 6.2).
 *
 * Files outside the resolved scope are never included (Req 6.3).
 */
export class DefaultScopeResolver implements ScopeResolver {
  private readonly detector: FileChangeDetector;

  constructor(detector: FileChangeDetector) {
    this.detector = detector;
  }

  resolve(modifiedFiles: string[], explicitScope?: string[]): ScopeResult {
    if (explicitScope && explicitScope.length > 0) {
      return this.resolveExplicit(explicitScope);
    }
    return this.resolveDefault(modifiedFiles);
  }

  /**
   * Default scope: include only the modified files and their changed sections.
   * Files with no tracked sections are still listed but get an empty section array.
   */
  private resolveDefault(modifiedFiles: string[]): ScopeResult {
    const files: string[] = [];
    const sections = new Map<string, CodeSection[]>();

    for (const filePath of modifiedFiles) {
      const fileSections = this.detector.getModifiedSections(filePath);
      files.push(filePath);
      sections.set(filePath, fileSections);
    }

    return { files, sections, isExplicit: false };
  }

  /**
   * Explicit scope: include exactly the specified paths.
   * Each path gets a full-file CodeSection placeholder (startLine 1, endLine
   * MAX_SAFE_INTEGER) so downstream pipeline stages know to process the
   * entire file.
   */
  private resolveExplicit(explicitPaths: string[]): ScopeResult {
    const files: string[] = [];
    const sections = new Map<string, CodeSection[]>();

    for (const targetPath of explicitPaths) {
      files.push(targetPath);
      sections.set(targetPath, [
        {
          filePath: targetPath,
          startLine: 1,
          endLine: Number.MAX_SAFE_INTEGER,
          content: '',
        },
      ]);
    }

    return { files, sections, isExplicit: true };
  }
}
