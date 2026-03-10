import { describe, it, expect } from 'vitest';
import { TypeScriptAnalyzer } from '../../../frontend/src/code-simplifier/analyzers/typescriptAnalyzer';
import type { CodeSection, Rule, RuleViolation, Transformation } from '../../../frontend/src/code-simplifier/types';

/** Helper to create a minimal CodeSection for testing. */
function makeSection(content: string): CodeSection {
  return {
    filePath: 'src/example.ts',
    startLine: 1,
    endLine: 10,
    content,
  };
}

/** Creates a stub Rule that always matches, returning a violation with the given ruleId. */
function matchingRule(ruleId: string): Rule {
  return {
    id: ruleId,
    language: 'typescript',
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
    language: 'typescript',
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

describe('TypeScriptAnalyzer', () => {
  it('has language set to typescript', () => {
    const analyzer = new TypeScriptAnalyzer([]);
    expect(analyzer.language).toBe('typescript');
  });

  it('returns empty array when no rules are provided', () => {
    const analyzer = new TypeScriptAnalyzer([]);
    const result = analyzer.analyze(makeSection('const x = 1;'));
    expect(result).toEqual([]);
  });

  it('returns empty array when no rules match', () => {
    const analyzer = new TypeScriptAnalyzer([
      nonMatchingRule('ts.standard.es-modules'),
      nonMatchingRule('ts.clarity.guard-clauses'),
    ]);
    const result = analyzer.analyze(makeSection('const x = 1;'));
    expect(result).toEqual([]);
  });

  it('collects violations from all matching rules', () => {
    const analyzer = new TypeScriptAnalyzer([
      matchingRule('ts.standard.es-modules'),
      matchingRule('ts.standard.import-sort'),
    ]);
    const result = analyzer.analyze(makeSection('const x = require("foo");'));
    expect(result).toHaveLength(2);
    expect(result[0].ruleId).toBe('ts.standard.es-modules');
    expect(result[1].ruleId).toBe('ts.standard.import-sort');
  });

  it('skips non-matching rules and includes only matching ones', () => {
    const analyzer = new TypeScriptAnalyzer([
      matchingRule('ts.standard.es-modules'),
      nonMatchingRule('ts.clarity.guard-clauses'),
      matchingRule('ts.naming.camelCase'),
    ]);
    const result = analyzer.analyze(makeSection('const x = 1;'));
    expect(result).toHaveLength(2);
    expect(result[0].ruleId).toBe('ts.standard.es-modules');
    expect(result[1].ruleId).toBe('ts.naming.camelCase');
  });

  it('passes the code section to each rule', () => {
    const section = makeSection('function foo() { return 42; }');
    const receivedSections: CodeSection[] = [];

    const spyRule: Rule = {
      id: 'ts.test.spy',
      language: 'typescript',
      category: 'standard',
      priority: 1,
      match(s: CodeSection): RuleViolation | null {
        receivedSections.push(s);
        return null;
      },
      transform(s: CodeSection): Transformation {
        return { ruleId: 'ts.test.spy', filePath: s.filePath, original: s.content, refined: s.content, startLine: s.startLine, endLine: s.endLine };
      },
    };

    const analyzer = new TypeScriptAnalyzer([spyRule]);
    analyzer.analyze(section);

    expect(receivedSections).toHaveLength(1);
    expect(receivedSections[0]).toBe(section);
  });
});
