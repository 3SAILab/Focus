// Core type definitions for the Code Simplifier refinement agent

/** A section of code within a file, identified by line range */
export interface CodeSection {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

/** Result of scope resolution — which files and sections to analyze */
export interface ScopeResult {
  files: string[];
  sections: Map<string, CodeSection[]>;
  isExplicit: boolean;
}

/** Languages supported by the Code Simplifier */
export type SupportedLanguage = 'typescript' | 'go';

/** A violation detected by a language analyzer against a project rule */
export interface RuleViolation {
  ruleId: string;
  severity: 'standard' | 'clarity';
  location: CodeSection;
  description: string;
  suggestedFix: Transformation;
}

/** A proposed code transformation */
export interface Transformation {
  ruleId: string;
  filePath: string;
  original: string;
  refined: string;
  startLine: number;
  endLine: number;
}

/** Result of behavior preservation validation */
export interface ValidationResult {
  safe: boolean;
  reason?: string;
}

/** Balance constraints checked before applying a transformation */
export interface BalanceCheck {
  preservesAbstractions: boolean;      // Req 5.1
  noUnrelatedCombining: boolean;       // Req 5.2
  noComplexFunctionalChains: boolean;  // Req 5.3
  preservesIntermediateVars: boolean;  // Req 5.4
  readabilityNotReduced: boolean;      // Req 5.5
}

/** Report generated after a refinement pass */
export interface RefinementReport {
  filesAnalyzed: number;
  transformationsApplied: Transformation[];
  transformationsDiscarded: Transformation[];
  errors: string[];
}

/** Internal state tracked during a refinement pass */
export interface RefinementPassState {
  triggeredAt: Date;
  scope: ScopeResult;
  phase: 'detecting' | 'analyzing' | 'transforming' | 'validating' | 'complete';
  violations: RuleViolation[];
  appliedTransformations: Transformation[];
  discardedTransformations: Transformation[];
}

/** A project rule that can match violations and produce transformations */
export interface Rule {
  id: string;
  language: SupportedLanguage;
  category: 'standard' | 'clarity' | 'naming';
  priority: number;
  match(section: CodeSection): RuleViolation | null;
  transform(section: CodeSection): Transformation;
}

// ---------------------------------------------------------------------------
// Component interfaces
// ---------------------------------------------------------------------------

/** Detects which files have been recently modified */
export interface FileChangeDetector {
  getModifiedFiles(): string[];
  getModifiedSections(filePath: string): CodeSection[];
}

/** Resolves the refinement scope from modified files or explicit paths */
export interface ScopeResolver {
  resolve(modifiedFiles: string[], explicitScope?: string[]): ScopeResult;
}

/** Routes files to the correct language-specific analyzer */
export interface LanguageRouter {
  route(filePath: string): LanguageAnalyzer | null;
}

/** Parses code and identifies rule violations for a specific language */
export interface LanguageAnalyzer {
  language: SupportedLanguage;
  analyze(section: CodeSection): RuleViolation[];
}

/** Holds the full rule set and orchestrates matching */
export interface RuleEngine {
  matchRules(violations: RuleViolation[]): Transformation[];
  getPrioritizedRules(language: SupportedLanguage): Rule[];
}

/** Validates that a transformation preserves observable behavior */
export interface BehaviorPreservationValidator {
  validate(transformation: Transformation, context: CodeSection): ValidationResult;
}

/** Orchestrates the full refinement cycle */
export interface RefinementPipeline {
  run(scope?: string[]): RefinementReport;
}
