import type {
  RefinementPipeline,
  RefinementReport,
  FileChangeDetector,
  ScopeResolver,
  LanguageRouter,
  RuleEngine,
  BehaviorPreservationValidator,
  Transformation,
  CodeSection,
} from '../types';

/**
 * Optional callback for post-validation (e.g. type checking / compilation).
 * Receives the file path and returns `true` if the file is valid.
 */
export type PostValidator = (filePath: string) => boolean;

/**
 * Optional callback to apply a transformation to the file system.
 * Receives the transformation and returns `true` on success.
 */
export type TransformationApplier = (transformation: Transformation) => boolean;

/**
 * Optional callback to rollback all transformations for a file.
 * Receives the file path and the original content map (startLine → original).
 */
export type TransformationRollback = (filePath: string, originals: Transformation[]) => void;

export interface RefinementPipelineOptions {
  fileChangeDetector: FileChangeDetector;
  scopeResolver: ScopeResolver;
  languageRouter: LanguageRouter;
  ruleEngine: RuleEngine;
  behaviorValidator: BehaviorPreservationValidator;
  postValidator?: PostValidator;
  applyTransformation?: TransformationApplier;
  rollbackTransformations?: TransformationRollback;
}

/**
 * Default implementation of {@link RefinementPipeline}.
 *
 * Orchestrates the full refinement cycle:
 * 1. Detect changed files via FileChangeDetector
 * 2. Resolve scope via ScopeResolver
 * 3. For each file, route to the correct analyzer via LanguageRouter
 * 4. For each section, analyze to get violations
 * 5. Pass violations to RuleEngine for prioritized transformations
 * 6. Validate each transformation via BehaviorPreservationValidator
 * 7. Apply safe transformations, discard unsafe ones
 * 8. Post-validation per file; rollback on failure
 * 9. Return RefinementReport
 *
 * Error handling:
 * - File read/parse failure → skip file, log in errors
 * - Transformation produces invalid code → discard, keep original
 * - Post-validation failure → rollback all transformations for that file
 * - Scope resolution failure → fall back to empty scope
 * - Language not supported → skip file silently
 */
export class DefaultRefinementPipeline implements RefinementPipeline {
  private readonly fileChangeDetector: FileChangeDetector;
  private readonly scopeResolver: ScopeResolver;
  private readonly languageRouter: LanguageRouter;
  private readonly ruleEngine: RuleEngine;
  private readonly behaviorValidator: BehaviorPreservationValidator;
  private readonly postValidator?: PostValidator;
  private readonly applyTransformation?: TransformationApplier;
  private readonly rollbackTransformations?: TransformationRollback;

  constructor(options: RefinementPipelineOptions) {
    this.fileChangeDetector = options.fileChangeDetector;
    this.scopeResolver = options.scopeResolver;
    this.languageRouter = options.languageRouter;
    this.ruleEngine = options.ruleEngine;
    this.behaviorValidator = options.behaviorValidator;
    this.postValidator = options.postValidator;
    this.applyTransformation = options.applyTransformation;
    this.rollbackTransformations = options.rollbackTransformations;
  }

  run(scope?: string[]): RefinementReport {
    const applied: Transformation[] = [];
    const discarded: Transformation[] = [];
    const errors: string[] = [];
    let filesAnalyzed = 0;

    // Step 1: Detect modified files
    let modifiedFiles: string[];
    try {
      modifiedFiles = this.fileChangeDetector.getModifiedFiles();
    } catch (err) {
      errors.push(`File change detection failed: ${errorMessage(err)}`);
      return { filesAnalyzed: 0, transformationsApplied: [], transformationsDiscarded: [], errors };
    }

    // Step 2: Resolve scope (fall back to empty scope on failure)
    let scopeResult;
    try {
      scopeResult = this.scopeResolver.resolve(modifiedFiles, scope);
    } catch (err) {
      errors.push(`Scope resolution failed, falling back to empty scope: ${errorMessage(err)}`);
      return { filesAnalyzed: 0, transformationsApplied: [], transformationsDiscarded: [], errors };
    }

    // Step 3–8: Process each file in scope
    for (const filePath of scopeResult.files) {
      // Step 3: Route to correct analyzer
      let analyzer;
      try {
        analyzer = this.languageRouter.route(filePath);
      } catch (err) {
        errors.push(`Language routing failed for ${filePath}: ${errorMessage(err)}`);
        continue;
      }

      // Language not supported → skip silently
      if (!analyzer) {
        continue;
      }

      filesAnalyzed++;

      // Get sections for this file
      const sections = scopeResult.sections.get(filePath) ?? [];
      if (sections.length === 0) {
        continue;
      }

      // Track transformations applied to this file for potential rollback
      const fileApplied: Transformation[] = [];

      // Step 4–7: Single-pass processing of all sections in this file
      for (const section of sections) {
        try {
          this.processSection(section, analyzer, fileApplied, discarded, errors);
        } catch (err) {
          errors.push(`Failed to process section ${filePath}:${section.startLine}-${section.endLine}: ${errorMessage(err)}`);
          // Skip section, continue with remaining sections (graceful degradation)
        }
      }

      // Step 8: Post-validation per file
      if (fileApplied.length > 0 && this.postValidator) {
        try {
          const valid = this.postValidator(filePath);
          if (!valid) {
            // Rollback all transformations for this file
            if (this.rollbackTransformations) {
              try {
                this.rollbackTransformations(filePath, fileApplied);
              } catch (rollbackErr) {
                errors.push(`Rollback failed for ${filePath}: ${errorMessage(rollbackErr)}`);
              }
            }
            errors.push(`Post-validation failed for ${filePath}, rolled back ${fileApplied.length} transformation(s)`);
            // Move file's applied transformations to discarded
            for (const t of fileApplied) {
              discarded.push(t);
            }
            continue; // Don't add to applied
          }
        } catch (err) {
          // Post-validation threw — treat as failure, rollback
          if (this.rollbackTransformations) {
            try {
              this.rollbackTransformations(filePath, fileApplied);
            } catch (rollbackErr) {
              errors.push(`Rollback failed for ${filePath}: ${errorMessage(rollbackErr)}`);
            }
          }
          errors.push(`Post-validation error for ${filePath}: ${errorMessage(err)}, rolled back ${fileApplied.length} transformation(s)`);
          for (const t of fileApplied) {
            discarded.push(t);
          }
          continue;
        }
      }

      // All transformations for this file passed — add to applied
      applied.push(...fileApplied);
    }

    return {
      filesAnalyzed,
      transformationsApplied: applied,
      transformationsDiscarded: discarded,
      errors,
    };
  }

  /**
   * Process a single code section: analyze → match rules → validate → apply.
   */
  private processSection(
    section: CodeSection,
    analyzer: { analyze(section: CodeSection): import('../types').RuleViolation[] },
    fileApplied: Transformation[],
    discarded: Transformation[],
    errors: string[],
  ): void {
    // Step 4: Analyze section for violations
    const violations = analyzer.analyze(section);
    if (violations.length === 0) {
      return;
    }

    // Step 5: Get prioritized transformations from rule engine
    const transformations = this.ruleEngine.matchRules(violations);

    // Step 6–7: Validate and apply each transformation
    for (const transformation of transformations) {
      try {
        const result = this.behaviorValidator.validate(transformation, section);

        if (result.safe) {
          // Apply the transformation
          if (this.applyTransformation) {
            try {
              const success = this.applyTransformation(transformation);
              if (success) {
                fileApplied.push(transformation);
              } else {
                discarded.push(transformation);
                errors.push(`Failed to apply transformation for rule ${transformation.ruleId} in ${transformation.filePath}`);
              }
            } catch (applyErr) {
              discarded.push(transformation);
              errors.push(`Error applying transformation for rule ${transformation.ruleId}: ${errorMessage(applyErr)}`);
            }
          } else {
            // No applier provided — just track as applied
            fileApplied.push(transformation);
          }
        } else {
          discarded.push(transformation);
        }
      } catch (err) {
        // Validation threw — discard the transformation
        discarded.push(transformation);
        errors.push(`Validation error for rule ${transformation.ruleId}: ${errorMessage(err)}`);
      }
    }
  }
}

/** Safely extract an error message from an unknown thrown value. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
