import { describe, it, expect } from 'vitest';
import { DefaultRuleEngine } from '../../../frontend/src/code-simplifier/pipeline/ruleEngine';
import type {
  Rule,
  CodeSection,
  RuleViolation,
  Transformation,
} from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRule(overrides: Partial<Rule> & Pick<Rule, 'id' | 'language' | 'category' | 'priority'>): Rule {
  return {
    match: () => null,
    transform: (section: CodeSection) => ({
      ruleId: overrides.id,
      filePath: section.filePath,
      original: section.content,
      refined: section.content,
      startLine: section.startLine,
      endLine: section.endLine,
    }),
    ...overrides,
  };
}

function makeViolation(
  ruleId: string,
  severity: 'standard' | 'clarity',
  filePath = 'src/test.ts',
): RuleViolation {
  const section: CodeSection = {
    filePath,
    startLine: 1,
    endLine: 10,
    content: 'original code',
  };
  return {
    ruleId,
    severity,
    location: section,
    description: `Violation for ${ruleId}`,
    suggestedFix: {
      ruleId,
      filePath,
      original: 'original code',
      refined: `refined by ${ruleId}`,
      startLine: 1,
      endLine: 10,
    },
  };
}

// ---------------------------------------------------------------------------
// Test rules
// ---------------------------------------------------------------------------

const tsStandardRule1 = makeRule({
  id: 'ts.standard.es-modules',
  language: 'typescript',
  category: 'standard',
  priority: 1,
});

const tsStandardRule2 = makeRule({
  id: 'ts.standard.import-sort',
  language: 'typescript',
  category: 'standard',
  priority: 2,
});

const tsNamingRule = makeRule({
  id: 'ts.naming.camelCase',
  language: 'typescript',
  category: 'naming',
  priority: 20,
});

const tsClarityRule = makeRule({
  id: 'ts.clarity.guard-clauses',
  language: 'typescript',
  category: 'clarity',
  priority: 10,
});

const goStandardRule = makeRule({
  id: 'go.standard.naming',
  language: 'go',
  category: 'standard',
  priority: 1,
});

const goClarityRule = makeRule({
  id: 'go.clarity.guard-clauses',
  language: 'go',
  category: 'clarity',
  priority: 10,
});

const goNamingRule = makeRule({
  id: 'go.naming.descriptive',
  language: 'go',
  category: 'naming',
  priority: 20,
});

const allRules: Rule[] = [
  tsStandardRule1,
  tsStandardRule2,
  tsNamingRule,
  tsClarityRule,
  goStandardRule,
  goClarityRule,
  goNamingRule,
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DefaultRuleEngine', () => {
  const engine = new DefaultRuleEngine(allRules);

  describe('getPrioritizedRules', () => {
    it('returns only TypeScript rules when language is typescript', () => {
      const rules = engine.getPrioritizedRules('typescript');
      expect(rules.every((r) => r.language === 'typescript')).toBe(true);
      expect(rules).toHaveLength(4);
    });

    it('returns only Go rules when language is go', () => {
      const rules = engine.getPrioritizedRules('go');
      expect(rules.every((r) => r.language === 'go')).toBe(true);
      expect(rules).toHaveLength(3);
    });

    it('sorts standards before naming before clarity for TypeScript', () => {
      const rules = engine.getPrioritizedRules('typescript');
      const categories = rules.map((r) => r.category);
      expect(categories).toEqual(['standard', 'standard', 'naming', 'clarity']);
    });

    it('sorts standards before naming before clarity for Go', () => {
      const rules = engine.getPrioritizedRules('go');
      const categories = rules.map((r) => r.category);
      expect(categories).toEqual(['standard', 'naming', 'clarity']);
    });

    it('sorts by rule priority within the same category', () => {
      const rules = engine.getPrioritizedRules('typescript');
      const standardRules = rules.filter((r) => r.category === 'standard');
      expect(standardRules[0].id).toBe('ts.standard.es-modules');
      expect(standardRules[1].id).toBe('ts.standard.import-sort');
    });

    it('returns empty array for a language with no rules', () => {
      const emptyEngine = new DefaultRuleEngine([]);
      expect(emptyEngine.getPrioritizedRules('typescript')).toEqual([]);
    });

    it('returns empty array when no rules match the language', () => {
      const tsOnlyEngine = new DefaultRuleEngine([tsStandardRule1]);
      expect(tsOnlyEngine.getPrioritizedRules('go')).toEqual([]);
    });
  });

  describe('matchRules', () => {
    it('returns transformations from violations in priority order', () => {
      const violations: RuleViolation[] = [
        makeViolation('ts.clarity.guard-clauses', 'clarity'),
        makeViolation('ts.standard.es-modules', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      expect(transformations).toHaveLength(2);
      // Standard should come before clarity
      expect(transformations[0].ruleId).toBe('ts.standard.es-modules');
      expect(transformations[1].ruleId).toBe('ts.clarity.guard-clauses');
    });

    it('orders standards before naming before clarity', () => {
      const violations: RuleViolation[] = [
        makeViolation('ts.clarity.guard-clauses', 'clarity'),
        makeViolation('ts.naming.camelCase', 'standard'),
        makeViolation('ts.standard.import-sort', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      expect(transformations[0].ruleId).toBe('ts.standard.import-sort');
      expect(transformations[1].ruleId).toBe('ts.naming.camelCase');
      expect(transformations[2].ruleId).toBe('ts.clarity.guard-clauses');
    });

    it('preserves rule priority order within the same category', () => {
      const violations: RuleViolation[] = [
        makeViolation('ts.standard.import-sort', 'standard'),
        makeViolation('ts.standard.es-modules', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      expect(transformations[0].ruleId).toBe('ts.standard.es-modules');
      expect(transformations[1].ruleId).toBe('ts.standard.import-sort');
    });

    it('returns empty array for empty violations', () => {
      expect(engine.matchRules([])).toEqual([]);
    });

    it('extracts suggestedFix from each violation', () => {
      const violations: RuleViolation[] = [
        makeViolation('ts.standard.es-modules', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      expect(transformations[0]).toEqual(violations[0].suggestedFix);
    });

    it('handles violations with unknown ruleIds gracefully using severity fallback', () => {
      const violations: RuleViolation[] = [
        makeViolation('unknown.rule', 'clarity'),
        makeViolation('ts.standard.es-modules', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      // Known standard rule should come before unknown clarity rule
      expect(transformations[0].ruleId).toBe('ts.standard.es-modules');
      expect(transformations[1].ruleId).toBe('unknown.rule');
    });

    it('handles mixed Go and TypeScript violations', () => {
      const violations: RuleViolation[] = [
        makeViolation('go.clarity.guard-clauses', 'clarity'),
        makeViolation('ts.standard.es-modules', 'standard'),
        makeViolation('go.standard.naming', 'standard'),
      ];

      const transformations = engine.matchRules(violations);

      // Both standard rules should come before clarity
      const standardTransforms = transformations.filter(
        (t) => t.ruleId.includes('.standard.'),
      );
      const clarityTransforms = transformations.filter(
        (t) => t.ruleId.includes('.clarity.'),
      );

      expect(standardTransforms).toHaveLength(2);
      expect(clarityTransforms).toHaveLength(1);

      // All standard transforms should appear before clarity transforms
      const lastStandardIdx = transformations.findLastIndex((t) =>
        t.ruleId.includes('.standard.'),
      );
      const firstClarityIdx = transformations.findIndex((t) =>
        t.ruleId.includes('.clarity.'),
      );
      expect(lastStandardIdx).toBeLessThan(firstClarityIdx);
    });
  });
});
