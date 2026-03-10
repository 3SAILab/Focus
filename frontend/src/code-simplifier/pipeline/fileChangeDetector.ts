import type { FileChangeDetector, CodeSection } from '../types';

/**
 * Default implementation of {@link FileChangeDetector}.
 *
 * Maintains an in-memory registry of files and sections that have been
 * modified during the current workspace session.  External callers
 * (e.g. editor hooks, file watchers) register modifications via
 * {@link trackModification}, and the pipeline queries the detector
 * through the interface methods.
 */
export class DefaultFileChangeDetector implements FileChangeDetector {
  /** file path → tracked sections */
  private readonly modifications = new Map<string, CodeSection[]>();

  /**
   * Record that a section of a file was modified.
   *
   * If the file has not been tracked yet it is added automatically.
   */
  trackModification(filePath: string, section: CodeSection): void {
    const existing = this.modifications.get(filePath) ?? [];
    existing.push(section);
    this.modifications.set(filePath, existing);
  }

  /** Return all file paths that have been modified in this session. */
  getModifiedFiles(): string[] {
    return Array.from(this.modifications.keys());
  }

  /**
   * Return the changed {@link CodeSection}s for a given file.
   *
   * Returns an empty array when the file has no tracked modifications.
   */
  getModifiedSections(filePath: string): CodeSection[] {
    return this.modifications.get(filePath) ?? [];
  }

  /** Remove all tracked modifications (useful for testing / reset). */
  clear(): void {
    this.modifications.clear();
  }
}
