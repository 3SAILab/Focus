import type { LanguageAnalyzer, CodeSection, Rule, RuleViolation } from '../types';

/**
 * Analyzes TypeScript and React code sections for rule violations.
 *
 * The analyzer delegates actual violation detection to the individual
 * {@link Rule} instances — it simply iterates over the provided rules,
 * calling `rule.match(section)` on each, and collects all non-null results.
 */
export class TypeScriptAnalyzer implements LanguageAnalyzer {
  readonly language = 'typescript' as const;

  private readonly rules: Rule[];

  constructor(rules: Rule[]) {
    this.rules = rules;
  }

  analyze(section: CodeSection): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.rules) {
      const violation = rule.match(section);
      if (violation !== null) {
        violations.push(violation);
      }
    }

    return violations;
  }
}
