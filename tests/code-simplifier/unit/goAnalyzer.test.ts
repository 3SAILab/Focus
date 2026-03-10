import { describe, it, expect } from 'vitest';
import { GoAnalyzer } from '../../../frontend/src/code-simplifier/analyzers/goAnalyzer';
import type { CodeSection, Rule, RuleViolation, Transformation } from '../../../frontend/src/code-simplifier/types';

/** Helper to create a minimal CodeSection for testing. */
function makeSection(content: string): CodeSection {
  return {
    filePath: 'backend/handlers/example.go',
    startLine: 1,
    endLine: 10,
    content,
  };
}

/** Creates a stub Rule that always matches, returning a violation with the given ruleId. */
function matchingRule(ruleId: string): Rule {
  return {
    id: ruleId,
    language: 'go',
    category: 'standard',
    priority: 1,
    match(section: CodeSection): RuleViolation {
      return {
        ruleId,
        severity: 'standard',
        location: section,
        description: `Violation of ${ruleId}`,
        suggestedFix: {
          ruleId,
          filePath: section.filePath,
          original: section.content,
          refined: section.content,
          startLine: section.startLine,
          endLine: section.endLine,
        },
      };
    },
    transform(section: CodeSection): Transformation {
      return {
        ruleId,
        filePath: section.filePath,
        original: section.content,
        refined: section.content,
        startLine: section.startLine,
        endLine: section.endLine,
      };
    },
  };
}

/** Creates a stub Rule that never matches (returns null). */
function nonMatchingRule(ruleId: string): Rule {
  return {
    id: ruleId,
    language: 'go',
    category: 'clarity',
    priority: 2,
    match(_section: CodeSection): RuleViolation | null {
      return null;
    },
    transform(section: CodeSection): Transformation {
      return {
        ruleId,
        filePath: section.filePath,
        original: section.content,
        refined: section.content,
        startLine: section.startLine,
        endLine: section.endLine,
      };
    },
  };
}

describe('GoAnalyzer', () => {
  it('has language set to go', () => {
    const analyzer = new GoAnalyzer([]);
    expect(analyzer.language).toBe('go');
  });

  it('returns empty array when no rules are provided', () => {
    const analyzer = new GoAnalyzer([]);
    const result = analyzer.analyze(makeSection('func main() {}'));
    expect(result).toEqual([]);
  });

  it('returns empty array when no rules match', () => {
    const analyzer = new GoAnalyzer([
      nonMatchingRule('go.standard.naming'),
      nonMatchingRule('go.clarity.guard-clauses'),
    ]);
    const result = analyzer.analyze(makeSection('func main() {}'));
    expect(result).toEqual([]);
  });

  it('collects violations from all matching rules', () => {
    const analyzer = new GoAnalyzer([
      matchingRule('go.standard.naming'),
      matchingRule('go.standard.error-handling'),
    ]);
    const result = analyzer.analyze(makeSection('func doStuff() error { return nil }'));
    expect(result).toHaveLength(2);
    expect(result[0].ruleId).toBe('go.standard.naming');
    expect(result[1].ruleId).toBe('go.standard.error-handling');
  });

  it('skips non-matching rules and includes only matching ones', () => {
    const analyzer = new GoAnalyzer([
      matchingRule('go.standard.naming'),
      nonMatchingRule('go.clarity.guard-clauses'),
      matchingRule('go.standard.import-grouping'),
    ]);
    const result = analyzer.analyze(makeSection('package main'));
    expect(result).toHaveLength(2);
    expect(result[0].ruleId).toBe('go.standard.naming');
    expect(result[1].ruleId).toBe('go.standard.import-grouping');
  });

  it('passes the code section to each rule', () => {
    const section = makeSection('func Hello() string { return "hello" }');
    const receivedSections: CodeSection[] = [];

    const spyRule: Rule = {
      id: 'go.test.spy',
      language: 'go',
      category: 'standard',
      priority: 1,
      match(s: CodeSection): RuleViolation | null {
        receivedSections.push(s);
        return null;
      },
      transform(s: CodeSection): Transformation {
        return { ruleId: 'go.test.spy', filePath: s.filePath, original: s.content, refined: s.content, startLine: s.startLine, endLine: s.endLine };
      },
    };

    const analyzer = new GoAnalyzer([spyRule]);
    analyzer.analyze(section);

    expect(receivedSections).toHaveLength(1);
    expect(receivedSections[0]).toBe(section);
  });
});
