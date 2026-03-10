// Code Simplifier — barrel export & factory

// Core types
export * from './types';

// Pipeline components
export { DefaultFileChangeDetector } from './pipeline/fileChangeDetector';
export { DefaultScopeResolver } from './pipeline/scopeResolver';
export { DefaultLanguageRouter } from './pipeline/languageRouter';
export { DefaultRuleEngine } from './pipeline/ruleEngine';
export {
  DefaultRefinementPipeline,
  type RefinementPipelineOptions,
  type PostValidator,
  type TransformationApplier,
  type TransformationRollback,
} from './pipeline/refinementPipeline';

// Analyzers
export { TypeScriptAnalyzer } from './analyzers/typescriptAnalyzer';
export { GoAnalyzer } from './analyzers/goAnalyzer';

// Validators
export { DefaultBehaviorPreservationValidator } from './validators/behaviorValidator';

// Rules
export { tsStandardRules } from './rules/ts.standard';
export { tsClarityRules } from './rules/ts.clarity';
export { tsNamingRules } from './rules/ts.naming';
export { goStandardRules } from './rules/go.standard';
export { goClarityRules } from './rules/go.clarity';
export { goNamingRules } from './rules/go.naming';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

import type { FileChangeDetector, SupportedLanguage, LanguageAnalyzer } from './types';
import { DefaultScopeResolver } from './pipeline/scopeResolver';
import { DefaultLanguageRouter } from './pipeline/languageRouter';
import { DefaultRuleEngine } from './pipeline/ruleEngine';
import {
  DefaultRefinementPipeline,
  type PostValidator,
  type TransformationApplier,
  type TransformationRollback,
} from './pipeline/refinementPipeline';
import { TypeScriptAnalyzer } from './analyzers/typescriptAnalyzer';
import { GoAnalyzer } from './analyzers/goAnalyzer';
import { DefaultBehaviorPreservationValidator } from './validators/behaviorValidator';
import { tsStandardRules } from './rules/ts.standard';
import { tsClarityRules } from './rules/ts.clarity';
import { tsNamingRules } from './rules/ts.naming';
import { goStandardRules } from './rules/go.standard';
import { goClarityRules } from './rules/go.clarity';
import { goNamingRules } from './rules/go.naming';

export interface CreateRefinementPipelineOptions {
  fileChangeDetector: FileChangeDetector;
  postValidator?: PostValidator;
  applyTransformation?: TransformationApplier;
  rollbackTransformations?: TransformationRollback;
}

/**
 * Factory that wires all rules, analyzers, and validators into a ready-to-use
 * {@link DefaultRefinementPipeline}.
 *
 * The caller must supply a {@link FileChangeDetector} (workspace-dependent).
 * Optional callbacks for post-validation, applying, and rolling back
 * transformations can be provided.
 */
export function createRefinementPipeline(
  options: CreateRefinementPipelineOptions,
): DefaultRefinementPipeline {
  // Collect all rules
  const allTsRules = [...tsStandardRules, ...tsNamingRules, ...tsClarityRules];
  const allGoRules = [...goStandardRules, ...goNamingRules, ...goClarityRules];
  const allRules = [...allTsRules, ...allGoRules];

  // Build analyzers
  const tsAnalyzer = new TypeScriptAnalyzer(allTsRules);
  const goAnalyzer = new GoAnalyzer(allGoRules);

  const analyzers = new Map<SupportedLanguage, LanguageAnalyzer>([
    ['typescript', tsAnalyzer],
    ['go', goAnalyzer],
  ]);

  // Assemble pipeline dependencies
  const scopeResolver = new DefaultScopeResolver(options.fileChangeDetector);
  const languageRouter = new DefaultLanguageRouter(analyzers);
  const ruleEngine = new DefaultRuleEngine(allRules);
  const behaviorValidator = new DefaultBehaviorPreservationValidator();

  return new DefaultRefinementPipeline({
    fileChangeDetector: options.fileChangeDetector,
    scopeResolver,
    languageRouter,
    ruleEngine,
    behaviorValidator,
    postValidator: options.postValidator,
    applyTransformation: options.applyTransformation,
    rollbackTransformations: options.rollbackTransformations,
  });
}
