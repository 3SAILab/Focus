import { describe, it, expect } from 'vitest';
import { tsStandardRules } from '../../../../frontend/src/code-simplifier/rules/ts.standard';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'src/example.ts'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = tsStandardRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('tsStandardRules array', () => {
  it('exports all 6 standard rules', () => {
    expect(tsStandardRules).toHaveLength(6);
  });

  it('all rules have language typescript and category standard', () => {
    for (const rule of tsStandardRules) {
      expect(rule.language).toBe('typescript');
      expect(rule.category).toBe('standard');
    }
  });

  it('all rules have unique ids', () => {
    const ids = tsStandardRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// ts.standard.es-modules
// ---------------------------------------------------------------------------

describe('ts.standard.es-modules', () => {
  const rule = findRule('ts.standard.es-modules');

  it('matches require() calls', () => {
    const section = makeSection("const fs = require('fs');");
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches module.exports', () => {
    const section = makeSection('module.exports = { foo };');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches exports.name assignments', () => {
    const section = makeSection('exports.handler = handler;');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match ES module syntax', () => {
    const section = makeSection("import fs from 'fs';\nexport const foo = 1;");
    expect(rule.match(section)).toBeNull();
  });

  it('transforms require() to import', () => {
    const section = makeSection("const path = require('path');");
    const result = rule.transform(section);
    expect(result.refined).toContain("import path from 'path'");
    expect(result.refined).not.toContain('require');
  });

  it('transforms module.exports to export default', () => {
    const section = makeSection('module.exports = handler;');
    const result = rule.transform(section);
    expect(result.refined).toContain('export default handler');
  });

  it('transforms exports.name to export const', () => {
    const section = makeSection('exports.foo = bar;');
    const result = rule.transform(section);
    expect(result.refined).toContain('export const foo = bar');
  });
});

// ---------------------------------------------------------------------------
// ts.standard.import-sort
// ---------------------------------------------------------------------------

describe('ts.standard.import-sort', () => {
  const rule = findRule('ts.standard.import-sort');

  it('does not match when there is only one import', () => {
    const section = makeSection("import React from 'react';");
    expect(rule.match(section)).toBeNull();
  });

  it('does not match already sorted imports', () => {
    const section = makeSection(
      "import React from 'react';\n\nimport { utils } from './utils';",
    );
    expect(rule.match(section)).toBeNull();
  });

  it('matches unsorted imports (relative before external)', () => {
    const section = makeSection(
      "import { utils } from './utils';\nimport React from 'react';",
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('transforms imports into correct order with blank line separators', () => {
    const section = makeSection(
      "import { helper } from './helper';\nimport React from 'react';\nimport { api } from '@/api';",
    );
    const result = rule.transform(section);
    const lines = result.refined.split('\n');

    // External first
    expect(lines[0]).toContain('react');
    // Then blank line + internal
    expect(lines.some((l) => l.includes('@/api'))).toBe(true);
    // Then blank line + relative
    expect(lines.some((l) => l.includes('./helper'))).toBe(true);
  });

  it('handles scoped external packages correctly', () => {
    const section = makeSection(
      "import { foo } from './foo';\nimport { bar } from '@org/bar';",
    );
    const result = rule.transform(section);
    const lines = result.refined.split('\n').filter((l) => l.trim());
    // @org/bar is external, should come first
    expect(lines[0]).toContain('@org/bar');
  });
});

// ---------------------------------------------------------------------------
// ts.standard.function-keyword
// ---------------------------------------------------------------------------

describe('ts.standard.function-keyword', () => {
  const rule = findRule('ts.standard.function-keyword');

  it('matches arrow function assigned to const', () => {
    const section = makeSection('const greet = (name: string) => {\n  return `Hello ${name}`;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches exported arrow function', () => {
    const section = makeSection('export const greet = (name: string) => {\n  return `Hello`;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches async arrow function', () => {
    const section = makeSection('const fetchData = async (url: string) => {\n  return fetch(url);\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match function declarations', () => {
    const section = makeSection('function greet(name: string) {\n  return `Hello ${name}`;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match short arrow callbacks (no block body at top level)', () => {
    const section = makeSection("const items = list.map((x) => x.id);");
    expect(rule.match(section)).toBeNull();
  });

  it('transforms arrow function to function declaration', () => {
    const section = makeSection('const greet = (name: string) => {\n  return `Hello`;\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('function greet(name: string)');
    expect(result.refined).not.toContain('=>');
  });

  it('transforms async arrow function preserving async keyword', () => {
    const section = makeSection('export const fetchData = async (url: string) => {\n  return fetch(url);\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('export async function fetchData(url: string)');
  });

  it('preserves return type annotation in transformation', () => {
    const section = makeSection('const add = (a: number, b: number): number => {\n  return a + b;\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('function add(a: number, b: number): number');
  });
});

// ---------------------------------------------------------------------------
// ts.standard.explicit-return-types
// ---------------------------------------------------------------------------

describe('ts.standard.explicit-return-types', () => {
  const rule = findRule('ts.standard.explicit-return-types');

  it('matches exported function without return type', () => {
    const section = makeSection('export function getData() {\n  return [];\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches exported async function without return type', () => {
    const section = makeSection('export async function fetchItems() {\n  return [];\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match exported function with return type', () => {
    const section = makeSection('export function getData(): string[] {\n  return [];\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match non-exported function', () => {
    const section = makeSection('function helper() {\n  return 1;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms by adding void return type placeholder', () => {
    const section = makeSection('export function process() {\n  console.log("done");\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('export function process(): void {');
  });

  it('does not modify functions that already have return types', () => {
    const section = makeSection('export function process(): void {\n  console.log("done");\n}');
    const result = rule.transform(section);
    expect(result.refined).toBe(section.content);
  });
});

// ---------------------------------------------------------------------------
// ts.standard.component-declaration
// ---------------------------------------------------------------------------

describe('ts.standard.component-declaration', () => {
  const rule = findRule('ts.standard.component-declaration');

  it('matches arrow function component with PascalCase name', () => {
    const section = makeSection('const MyComponent = (props: Props) => {\n  return <div />;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches exported arrow function component', () => {
    const section = makeSection('export const Header = () => {\n  return <header />;\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match function declaration component', () => {
    const section = makeSection('function MyComponent(props: Props) {\n  return <div />;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match lowercase arrow functions (not components)', () => {
    const section = makeSection('const helper = () => {\n  return 1;\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms arrow component to function declaration', () => {
    const section = makeSection('export const Card = (props: CardProps) => {\n  return <div />;\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('export function Card(props: CardProps)');
    expect(result.refined).not.toContain('=>');
  });
});

// ---------------------------------------------------------------------------
// ts.standard.props-interface
// ---------------------------------------------------------------------------

describe('ts.standard.props-interface', () => {
  const rule = findRule('ts.standard.props-interface');

  it('matches inline object type for props', () => {
    const section = makeSection(
      'function Button({ label }: { label: string }) {\n  return <button>{label}</button>;\n}',
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match when props use an interface reference', () => {
    const section = makeSection(
      'function Button({ label }: ButtonProps) {\n  return <button>{label}</button>;\n}',
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match non-component functions', () => {
    const section = makeSection(
      'function calculate(opts: { a: number; b: number }) {\n  return opts.a + opts.b;\n}',
    );
    expect(rule.match(section)).toBeNull();
  });

  it('transforms inline props to extracted interface', () => {
    const section = makeSection(
      'function Modal({ open, title }: { open: boolean; title: string }) {\n  return <div />;\n}',
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('interface ModalProps');
    expect(result.refined).toContain('open: boolean; title: string');
    expect(result.refined).toContain('function Modal({ open, title }: ModalProps)');
  });
});
