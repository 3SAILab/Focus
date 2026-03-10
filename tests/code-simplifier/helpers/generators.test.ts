/**
 * Smoke test to verify that all shared generators produce valid instances.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  arbCodeSection,
  arbTransformation,
  arbScopeResult,
  arbRuleViolation,
} from './generators';

describe('shared generators', () => {
  it('arbCodeSection produces valid CodeSection objects', () => {
    fc.assert(
      fc.property(arbCodeSection, (section) => {
        expect(section.filePath).toBeTruthy();
        expect(section.startLine).toBeGreaterThanOrEqual(1);
        expect(section.endLine).toBeGreaterThanOrEqual(section.startLine);
        expect(typeof section.content).toBe('string');
      }),
      { numRuns: 50 },
    );
  });

  it('arbTransformation produces valid Transformation objects', () => {
    fc.assert(
      fc.property(arbTransformation, (t) => {
        expect(t.ruleId).toBeTruthy();
        expect(t.filePath).toBeTruthy();
        expect(typeof t.original).toBe('string');
        expect(typeof t.refined).toBe('string');
        expect(t.startLine).toBeGreaterThanOrEqual(1);
        expect(t.endLine).toBeGreaterThanOrEqual(t.startLine);
      }),
      { numRuns: 50 },
    );
  });

  it('arbScopeResult produces valid ScopeResult objects', () => {
    fc.assert(
      fc.property(arbScopeResult, (scope) => {
        expect(Array.isArray(scope.files)).toBe(true);
        expect(scope.sections).toBeInstanceOf(Map);
        expect(typeof scope.isExplicit).toBe('boolean');
      }),
      { numRuns: 50 },
    );
  });

  it('arbRuleViolation produces valid RuleViolation objects', () => {
    fc.assert(
      fc.property(arbRuleViolation, (v) => {
        expect(v.ruleId).toBeTruthy();
        expect(['standard', 'clarity']).toContain(v.severity);
        expect(v.location).toBeDefined();
        expect(v.description).toBeTruthy();
        expect(v.suggestedFix).toBeDefined();
      }),
      { numRuns: 50 },
    );
  });
});
