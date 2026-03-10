# Implementation Plan: Code Simplifier

## Overview

Implement the Code Simplifier as a pipeline-based refinement agent in TypeScript. The implementation proceeds bottom-up: core interfaces and data models first, then individual rule implementations for TypeScript and Go, then the behavior validator, then the pipeline orchestrator, and finally integration wiring and tests. Each task builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Create directory structure and core type definitions
    - Create `frontend/src/code-simplifier/` directory with subdirectories: `rules/`, `analyzers/`, `validators/`, `pipeline/`
    - Create `frontend/src/code-simplifier/types.ts` defining all core interfaces: `CodeSection`, `ScopeResult`, `SupportedLanguage`, `RuleViolation`, `Transformation`, `ValidationResult`, `BalanceCheck`, `RefinementReport`, `RefinementPassState`, `Rule`
    - Create `frontend/src/code-simplifier/index.ts` barrel export
    - _Requirements: 1.1, 1.2, 2.1–2.6, 3.1–3.4, 5.1–5.5_

  - [x] 1.2 Set up testing framework with fast-check
    - Create `tests/code-simplifier/` directory with `unit/` and `property/` subdirectories
    - Add fast-check dependency if not present
    - Create test helper utilities and shared generators for random `CodeSection`, `Transformation`, and `ScopeResult` objects
    - _Requirements: 8.4_

- [x] 2. Implement File Change Detection and Scope Resolution
  - [x] 2.1 Implement FileChangeDetector
    - Create `frontend/src/code-simplifier/pipeline/fileChangeDetector.ts`
    - Implement `getModifiedFiles()` to return recently modified file paths in the workspace session
    - Implement `getModifiedSections(filePath)` to return `CodeSection[]` for changed regions within a file
    - _Requirements: 6.1, 7.1, 8.1_

  - [x] 2.2 Implement ScopeResolver
    - Create `frontend/src/code-simplifier/pipeline/scopeResolver.ts`
    - Implement `resolve()` that narrows scope to modified sections by default
    - Support explicit scope expansion when developer provides file/directory paths
    - Ensure no files outside resolved scope are included
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.3 Write property tests for scope containment
    - **Property 18: Scope Containment** — verify default scope only includes recently modified files and sections
    - **Validates: Requirements 6.1, 6.3, 6.4**

  - [x] 2.4 Write property test for explicit scope expansion
    - **Property 19: Explicit Scope Expansion** — verify explicit scope analyzes exactly the specified targets
    - **Validates: Requirements 6.2**

- [x] 3. Implement Language Router and Analyzers
  - [x] 3.1 Implement LanguageRouter
    - Create `frontend/src/code-simplifier/pipeline/languageRouter.ts`
    - Route `.ts`/`.tsx` files to TypeScript analyzer, `.go` files to Go analyzer
    - Skip unsupported file extensions silently
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Implement TypeScriptAnalyzer
    - Create `frontend/src/code-simplifier/analyzers/typescriptAnalyzer.ts`
    - Parse TypeScript/React code sections and identify rule violations
    - Return `RuleViolation[]` with suggested fixes for each violation found
    - _Requirements: 2.1–2.6, 4.1–4.6, 9.1–9.4_

  - [x] 3.3 Implement GoAnalyzer
    - Create `frontend/src/code-simplifier/analyzers/goAnalyzer.ts`
    - Parse Go code sections and identify rule violations
    - Return `RuleViolation[]` with suggested fixes for each violation found
    - _Requirements: 3.1–3.4, 4.1–4.6_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement TypeScript/React Rules
  - [x] 5.1 Implement TypeScript standard rules
    - Create `frontend/src/code-simplifier/rules/ts.standard.ts`
    - Implement rules: `ts.standard.es-modules`, `ts.standard.import-sort`, `ts.standard.function-keyword`, `ts.standard.explicit-return-types`, `ts.standard.component-declaration`, `ts.standard.props-interface`
    - Each rule implements the `Rule` interface with `match()` and `transform()` methods
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.2 Write property tests for TypeScript standard rules
    - **Property 4: ES Module Enforcement** — verify no `require()` or `module.exports` after refinement
    - **Validates: Requirements 2.1**

  - [x] 5.3 Write property test for import sort order
    - **Property 5: Import Sort Order** — verify imports ordered external → internal → relative with blank line separators
    - **Validates: Requirements 2.2**

  - [x] 5.4 Write property test for function keyword usage
    - **Property 6: Function Keyword Usage** — verify named declarations use `function` keyword
    - **Validates: Requirements 2.3**

  - [x] 5.5 Write property test for explicit return types
    - **Property 7: Explicit Return Types** — verify all exported functions have return type annotations
    - **Validates: Requirements 2.4**

  - [x] 5.6 Write property test for React component pattern
    - **Property 8: React Component Pattern** — verify components are named function declarations with interface-typed props
    - **Validates: Requirements 2.5, 2.6**

  - [x] 5.7 Implement TypeScript clarity rules
    - Create `frontend/src/code-simplifier/rules/ts.clarity.ts`
    - Implement rules: `ts.clarity.guard-clauses`, `ts.clarity.remove-redundancy`, `ts.clarity.no-nested-ternary`, `ts.clarity.consolidate-logic`, `ts.clarity.remove-restating-comments`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.8 Write property test for nesting depth reduction
    - **Property 13: Nesting Depth Reduction** — verify nesting depth does not increase after refinement
    - **Validates: Requirements 4.1**

  - [x] 5.9 Write property test for redundancy removal
    - **Property 14: Redundancy Removal** — verify no unused variables, unreachable code, or duplicate logic remain
    - **Validates: Requirements 4.2**

  - [x] 5.10 Write property test for no nested ternaries
    - **Property 15: No Nested Ternaries** — verify no nested ternary operators after refinement
    - **Validates: Requirements 4.3**

  - [x] 5.11 Implement TypeScript naming rules
    - Create `frontend/src/code-simplifier/rules/ts.naming.ts`
    - Implement rules: `ts.naming.camelCase`, `ts.naming.PascalCase`, `ts.naming.descriptive`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.12 Write property test for TypeScript naming conventions
    - **Property 23: TypeScript Naming Conventions** — verify camelCase for locals/params and PascalCase for components/interfaces/types
    - **Validates: Requirements 9.1, 9.2**

  - [x] 5.13 Write property test for descriptive naming
    - **Property 24: Descriptive Naming** — verify no single-letter variables except in short lambdas and loop indices
    - **Validates: Requirements 9.4**

- [x] 6. Implement Go Rules
  - [x] 6.1 Implement Go standard rules
    - Create `frontend/src/code-simplifier/rules/go.standard.ts`
    - Implement rules: `go.standard.naming`, `go.standard.error-handling`, `go.standard.early-returns`, `go.standard.import-grouping`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Write property test for Go naming conventions
    - **Property 9: Go Naming Conventions** — verify camelCase for unexported and PascalCase for exported identifiers
    - **Validates: Requirements 3.1**

  - [x] 6.3 Write property test for Go error handling completeness
    - **Property 10: Go Error Handling Completeness** — verify every error return value is checked and handled
    - **Validates: Requirements 3.2**

  - [x] 6.4 Write property test for Go early returns
    - **Property 11: Go Early Returns** — verify error handling uses early return patterns
    - **Validates: Requirements 3.3**

  - [x] 6.5 Write property test for Go import grouping
    - **Property 12: Go Import Grouping** — verify imports grouped: stdlib → external → internal with blank line separators
    - **Validates: Requirements 3.4**

  - [x] 6.6 Implement Go clarity and naming rules
    - Create `frontend/src/code-simplifier/rules/go.clarity.ts` and `frontend/src/code-simplifier/rules/go.naming.ts`
    - Implement rules: `go.clarity.guard-clauses`, `go.clarity.remove-redundancy`, `go.clarity.consolidate-logic`, `go.naming.descriptive`
    - _Requirements: 4.1, 4.2, 4.4, 9.4_

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement Rule Engine and Behavior Preservation Validator
  - [x] 8.1 Implement RuleEngine
    - Create `frontend/src/code-simplifier/pipeline/ruleEngine.ts`
    - Implement `matchRules()` to collect and prioritize transformations from violations
    - Implement `getPrioritizedRules()` returning rules ordered: standards first, then naming, then clarity
    - Ensure standards-before-clarity ordering per Requirement 8.3
    - _Requirements: 8.2, 8.3_

  - [x] 8.2 Write property test for standards-before-clarity ordering
    - **Property 21: Standards-Before-Clarity Ordering** — verify all standard transformations applied before clarity transformations
    - **Validates: Requirements 8.3**

  - [x] 8.3 Implement BehaviorPreservationValidator
    - Create `frontend/src/code-simplifier/validators/behaviorValidator.ts`
    - Implement validation checks: public API signatures unchanged, error handling paths preserved, side-effect order maintained, no removal of reachable code paths
    - Implement `BalanceCheck` evaluation: preserves abstractions, no unrelated combining, no complex functional chains, preserves intermediate variables, readability not reduced
    - Discard transformations that fail any check
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.4 Write property tests for behavior preservation
    - **Property 1: Behavior Preservation Invariant** — verify refined code preserves observable behavior or refinement is discarded
    - **Validates: Requirements 1.1, 1.5**

  - [x] 8.5 Write property test for structural preservation
    - **Property 2: Structural Preservation** — verify public API signatures and error paths are identical after refinement
    - **Validates: Requirements 1.2, 1.3**

  - [x] 8.6 Write property test for side-effect order preservation
    - **Property 3: Side-Effect Order Preservation** — verify relative ordering of side-effect statements is unchanged
    - **Validates: Requirements 1.4**

  - [x] 8.7 Write property test for abstraction preservation
    - **Property 16: Abstraction Preservation** — verify function/module count does not decrease after refinement
    - **Validates: Requirements 5.1**

  - [x] 8.8 Write property test for intermediate variable preservation
    - **Property 17: Intermediate Variable Preservation** — verify named intermediate variables are not inlined
    - **Validates: Requirements 5.4**

- [x] 9. Implement Refinement Pipeline Orchestrator
  - [x] 9.1 Implement RefinementPipeline
    - Create `frontend/src/code-simplifier/pipeline/refinementPipeline.ts`
    - Wire together: FileChangeDetector → ScopeResolver → LanguageRouter → Analyzers → RuleEngine → BehaviorPreservationValidator → Apply/Rollback
    - Implement single-pass processing per modified section
    - Implement post-validation (type checking) after applying transformations
    - Implement rollback on post-validation failure (per-file rollback, not global)
    - Implement error handling: skip files on parse failure, discard invalid transformations, graceful degradation
    - Generate `RefinementReport` with applied/discarded transformations and errors
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 9.2 Write property test for single-pass completeness
    - **Property 20: Single-Pass Completeness** — verify all refinement opportunities processed in a single pass per section
    - **Validates: Requirements 7.1, 7.3**

  - [x] 9.3 Write property test for post-refinement compilation
    - **Property 22: Post-Refinement Compilation** — verify refined code compiles and maintains type correctness
    - **Validates: Requirements 8.4**

- [x] 10. Integration wiring and barrel exports
  - [x] 10.1 Wire all components and create public API
    - Update `frontend/src/code-simplifier/index.ts` to export the `RefinementPipeline` and all public interfaces
    - Create a factory function or entry point that instantiates the pipeline with all rules, analyzers, and validators
    - Ensure the pipeline can be triggered from the workspace (autonomous operation hook)
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Write integration tests for the full pipeline
    - Test end-to-end: modified TypeScript file → pipeline → refined output with standards applied
    - Test end-to-end: modified Go file → pipeline → refined output with standards applied
    - Test rollback on post-validation failure
    - Test scope containment across multiple files
    - _Requirements: 1.1, 2.1, 3.1, 6.1, 8.4_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All 24 correctness properties from the design are covered across property test tasks
