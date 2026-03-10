import type {
  RuleEngine,
  Rule,
  RuleViolation,
  Transformation,
  SupportedLanguage,
} from '../types';

/**
 * Category priority mapping for rule ordering.
 * Standards are applied first, then naming, then clarity (Requirement 8.3).
 */
const CATEGORY_PRIORITY: Record<Rule['category'], number> = {
  standard: 0,
  naming: 1,
  clarity: 2,
};

/**
 * Default implementation of the {@link RuleEngine} interface.
 *
 * Holds the full set of project rules and provides:
 * - `getPrioritizedRules(language)` — returns rules filtered by language and
 *   sorted by category priority (standard → naming → clarity), then by each
 *   rule's own priority number.
 * - `matchRules(violations)` — extracts the `suggestedFix` Transformation from
 *   each violation, ordered by category priority then rule priority.
 */
export class DefaultRuleEngine implements RuleEngine {
  private readonly rules: Rule[];

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  getPrioritizedRules(language: SupportedLanguage): Rule[] {
    return this.rules
      .filter((rule) => rule.language === language)
      .sort((a, b) => {
        const catDiff = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
        if (catDiff !== 0) return catDiff;
        return a.priority - b.priority;
      });
  }

  matchRules(violations: RuleViolation[]): Transformation[] {
    // Build a lookup from ruleId → Rule for priority info
    const ruleMap = new Map<string, Rule>();
    for (const rule of this.rules) {
      ruleMap.set(rule.id, rule);
    }

    // Sort violations by the associated rule's category priority, then rule priority
    const sorted = [...violations].sort((a, b) => {
      const ruleA = ruleMap.get(a.ruleId);
      const ruleB = ruleMap.get(b.ruleId);

      const catA = ruleA ? CATEGORY_PRIORITY[ruleA.category] : CATEGORY_PRIORITY[a.severity === 'standard' ? 'standard' : 'clarity'];
      const catB = ruleB ? CATEGORY_PRIORITY[ruleB.category] : CATEGORY_PRIORITY[b.severity === 'standard' ? 'standard' : 'clarity'];

      const catDiff = catA - catB;
      if (catDiff !== 0) return catDiff;

      const prioA = ruleA?.priority ?? Number.MAX_SAFE_INTEGER;
      const prioB = ruleB?.priority ?? Number.MAX_SAFE_INTEGER;
      return prioA - prioB;
    });

    return sorted.map((v) => v.suggestedFix);
  }
}
