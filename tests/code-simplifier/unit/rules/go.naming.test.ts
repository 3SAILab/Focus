import { describe, it, expect } from 'vitest';
import { goNamingRules } from '../../../../frontend/src/code-simplifier/rules/go.naming';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'backend/example.go'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = goNamingRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('goNamingRules array', () => {
  it('exports 1 naming rule', () => {
    expect(goNamingRules).toHaveLength(1);
  });

  it('all rules have language go and category naming', () => {
    for (const rule of goNamingRules) {
      expect(rule.language).toBe('go');
      expect(rule.category).toBe('naming');
    }
  });

  it('all rules have unique ids', () => {
    const ids = goNamingRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rules have priority >= 20', () => {
    for (const rule of goNamingRules) {
      expect(rule.priority).toBeGreaterThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// go.naming.descriptive (Req 9.4)
// ---------------------------------------------------------------------------

describe('go.naming.descriptive', () => {
  const rule = findRule('go.naming.descriptive');

  it('matches single-letter short variable declaration', () => {
    const section = makeSection('x := 42');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches single-letter var declaration', () => {
    const section = makeSection('var x int');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches single-letter function parameter', () => {
    const section = makeSection('func process(x int) {\n\tfmt.Println(x)\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match idiomatic loop index i', () => {
    const section = makeSection('for i := 0; i < 10; i++ {\n\tfmt.Println(i)\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match idiomatic loop index j', () => {
    const section = makeSection('for j := 0; j < len(arr); j++ {\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match idiomatic err variable', () => {
    const section = makeSection('err := doSomething()');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match descriptive variable names', () => {
    const section = makeSection('count := 42\nmessage := "hello"');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match idiomatic k, v in range clause', () => {
    const section = makeSection('for k, v := range items {\n\tfmt.Println(k, v)\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('violation description lists the single-letter names', () => {
    const section = makeSection('x := 1\ny := 2');
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('x');
  });

  it('violation has correct ruleId', () => {
    const section = makeSection('x := 42');
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.ruleId).toBe('go.naming.descriptive');
  });

  it('transform adds TODO comment for single-letter variables', () => {
    const section = makeSection('x := 42');
    const result = rule.transform(section);
    expect(result.refined).toContain('TODO');
    expect(result.refined).toContain('x');
    expect(result.refined).toContain('x := 42');
  });

  it('transform preserves metadata', () => {
    const section = makeSection('x := 1', 'backend/math.go');
    const result = rule.transform(section);
    expect(result.filePath).toBe('backend/math.go');
    expect(result.original).toBe(section.content);
    expect(result.ruleId).toBe('go.naming.descriptive');
  });
});
