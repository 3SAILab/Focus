import { describe, it, expect } from 'vitest';
import { tsNamingRules } from '../../../../frontend/src/code-simplifier/rules/ts.naming';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'src/example.ts'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = tsNamingRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('tsNamingRules array', () => {
  it('exports all 3 naming rules', () => {
    expect(tsNamingRules).toHaveLength(3);
  });

  it('all rules have language typescript and category naming', () => {
    for (const rule of tsNamingRules) {
      expect(rule.language).toBe('typescript');
      expect(rule.category).toBe('naming');
    }
  });

  it('all rules have unique ids', () => {
    const ids = tsNamingRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rules have priority >= 20', () => {
    for (const rule of tsNamingRules) {
      expect(rule.priority).toBeGreaterThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// ts.naming.camelCase (Req 9.1)
// ---------------------------------------------------------------------------

describe('ts.naming.camelCase', () => {
  const rule = findRule('ts.naming.camelCase');

  it('matches snake_case local variable', () => {
    const section = makeSection('const my_variable = 42;');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches PascalCase local variable (non-component)', () => {
    const section = makeSection('let MyValue = "hello";');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match camelCase local variable', () => {
    const section = makeSection('const myVariable = 42;');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match exported declarations', () => {
    const section = makeSection('export const MyThing = 42;');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match CONSTANT_CASE', () => {
    const section = makeSection('const MAX_RETRIES = 3;');
    expect(rule.match(section)).toBeNull();
  });

  it('matches non-camelCase unexported function name', () => {
    const section = makeSection('function MyHelper() {\n  return 1;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match camelCase unexported function name', () => {
    const section = makeSection('function myHelper() {\n  return 1;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('violation description lists the offending names', () => {
    const section = makeSection('const my_var = 1;\nlet Another_one = 2;');
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('my_var');
  });

  it('transform converts snake_case to camelCase', () => {
    const section = makeSection('const my_variable = 42;\nconsole.log(my_variable);');
    const result = rule.transform(section);
    expect(result.refined).toContain('myVariable');
    expect(result.refined).not.toContain('my_variable');
  });

  it('transform preserves metadata', () => {
    const section = makeSection('const my_var = 1;', 'src/utils.ts');
    const result = rule.transform(section);
    expect(result.filePath).toBe('src/utils.ts');
    expect(result.original).toBe(section.content);
    expect(result.ruleId).toBe('ts.naming.camelCase');
  });
});

// ---------------------------------------------------------------------------
// ts.naming.PascalCase (Req 9.2)
// ---------------------------------------------------------------------------

describe('ts.naming.PascalCase', () => {
  const rule = findRule('ts.naming.PascalCase');

  it('matches non-PascalCase interface name', () => {
    const section = makeSection('interface myInterface {\n  name: string;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches non-PascalCase type alias', () => {
    const section = makeSection('type myType = string | number;');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches snake_case interface', () => {
    const section = makeSection('interface my_props {\n  title: string;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match PascalCase interface', () => {
    const section = makeSection('interface MyInterface {\n  name: string;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match PascalCase type alias', () => {
    const section = makeSection('type MyType = string | number;');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match exported PascalCase interface', () => {
    const section = makeSection('export interface UserProps {\n  name: string;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('violation description lists the offending names', () => {
    const section = makeSection('interface badName {\n  x: number;\n}');
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('badName');
  });

  it('transform converts camelCase interface to PascalCase', () => {
    const section = makeSection('interface myProps {\n  title: string;\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('interface MyProps');
  });

  it('transform converts camelCase type alias to PascalCase', () => {
    const section = makeSection('type buttonVariant = "primary" | "secondary";');
    const result = rule.transform(section);
    expect(result.refined).toContain('type ButtonVariant');
  });

  it('transform preserves metadata', () => {
    const section = makeSection('interface badName {}', 'src/types.ts');
    const result = rule.transform(section);
    expect(result.filePath).toBe('src/types.ts');
    expect(result.original).toBe(section.content);
    expect(result.ruleId).toBe('ts.naming.PascalCase');
  });
});

// ---------------------------------------------------------------------------
// ts.naming.descriptive (Req 9.4)
// ---------------------------------------------------------------------------

describe('ts.naming.descriptive', () => {
  const rule = findRule('ts.naming.descriptive');

  it('matches single-letter variable declaration', () => {
    const section = makeSection('const x = 42;');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches single-letter let declaration', () => {
    const section = makeSection('let y = "hello";');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match loop index i in for loop', () => {
    const section = makeSection('for (let i = 0; i < 10; i++) {\n  console.log(i);\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match short lambda parameter', () => {
    const section = makeSection('const items = list.map((x) => x.id);');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match descriptive variable names', () => {
    const section = makeSection('const count = 42;\nlet message = "hello";');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match loop index j in for loop', () => {
    const section = makeSection('for (let j = 0; j < arr.length; j++) {}');
    expect(rule.match(section)).toBeNull();
  });

  it('violation description lists the single-letter names', () => {
    const section = makeSection('const x = 1;\nlet y = 2;');
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('x');
  });

  it('transform adds TODO comment for single-letter variables', () => {
    const section = makeSection('const x = 42;');
    const result = rule.transform(section);
    expect(result.refined).toContain('TODO');
    expect(result.refined).toContain('x');
    // Original code is preserved
    expect(result.refined).toContain('const x = 42;');
  });

  it('transform preserves metadata', () => {
    const section = makeSection('const x = 1;', 'src/math.ts');
    const result = rule.transform(section);
    expect(result.filePath).toBe('src/math.ts');
    expect(result.original).toBe(section.content);
    expect(result.ruleId).toBe('ts.naming.descriptive');
  });
});
