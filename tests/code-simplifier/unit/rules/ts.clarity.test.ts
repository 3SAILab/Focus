import { describe, it, expect } from 'vitest';
import { tsClarityRules } from '../../../../frontend/src/code-simplifier/rules/ts.clarity';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'src/example.ts'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = tsClarityRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('tsClarityRules array', () => {
  it('exports all 5 clarity rules', () => {
    expect(tsClarityRules).toHaveLength(5);
  });

  it('all rules have language typescript and category clarity', () => {
    for (const rule of tsClarityRules) {
      expect(rule.language).toBe('typescript');
      expect(rule.category).toBe('clarity');
    }
  });

  it('all rules have unique ids', () => {
    const ids = tsClarityRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rules have priority >= 10', () => {
    for (const rule of tsClarityRules) {
      expect(rule.priority).toBeGreaterThanOrEqual(10);
    }
  });
});

// ---------------------------------------------------------------------------
// ts.clarity.guard-clauses (Req 4.1)
// ---------------------------------------------------------------------------

describe('ts.clarity.guard-clauses', () => {
  const rule = findRule('ts.clarity.guard-clauses');

  it('matches deeply nested if/else blocks (3+ levels)', () => {
    const section = makeSection(
      `function process(x) {
  if (x) {
    if (y) {
      if (z) {
        doSomething();
      }
    }
  }
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches else blocks containing nested if', () => {
    const section = makeSection(
      `function handle(a) {
  if (a > 0) {
    doA();
  } else {
    if (a < 0) {
      doB();
    }
  }
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match simple if without deep nesting', () => {
    const section = makeSection(
      `function check(x) {
  if (x) {
    return true;
  }
  return false;
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match flat if/else (no nesting)', () => {
    const section = makeSection(
      `if (a) {
  doA();
} else {
  doB();
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation has correct ruleId and severity', () => {
    const section = makeSection(
      `function f() {
  if (a) {
    if (b) {
      if (c) {
        return 1;
      }
    }
  }
}`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.ruleId).toBe('ts.clarity.guard-clauses');
    expect(violation!.severity).toBe('clarity');
  });

  it('transform converts if/else with early return into guard clause', () => {
    const section = makeSection(
      `if (condition) {
  return early;
} else {
  doWork();
}`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('if (condition)');
    expect(result.refined).toContain('return early');
    // The else wrapper should be removed
    expect(result.refined).not.toContain('} else {');
  });

  it('transform preserves filePath and line info', () => {
    const section = makeSection('if (a) {\n  if (b) {\n    if (c) { return; }\n  }\n}', 'src/deep.ts');
    const result = rule.transform(section);
    expect(result.filePath).toBe('src/deep.ts');
    expect(result.startLine).toBe(section.startLine);
    expect(result.endLine).toBe(section.endLine);
  });
});

// ---------------------------------------------------------------------------
// ts.clarity.remove-redundancy (Req 4.2)
// ---------------------------------------------------------------------------

describe('ts.clarity.remove-redundancy', () => {
  const rule = findRule('ts.clarity.remove-redundancy');

  it('matches unused variables', () => {
    const section = makeSection(
      `const unusedVar = 42;
function doWork() {
  return 1;
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches unreachable code after return', () => {
    const section = makeSection(
      `function example() {
  return 42;
  console.log("unreachable");
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches duplicate logic (identical lines)', () => {
    const section = makeSection(
      `console.log("processing item");
doSomething();
console.log("processing item");`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match when all variables are used', () => {
    const section = makeSection(
      `const value = compute();
console.log(value);`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match code without redundancy', () => {
    const section = makeSection(
      `function add(a: number, b: number) {
  return a + b;
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation description mentions unused variables by name', () => {
    const section = makeSection(
      `const orphan = "never used";
doWork();`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('orphan');
  });

  it('transform removes unused variable declarations', () => {
    const section = makeSection(
      `const unused = 42;
const used = 10;
console.log(used);`,
    );
    const result = rule.transform(section);
    expect(result.refined).not.toContain('const unused');
    expect(result.refined).toContain('const used');
    expect(result.refined).toContain('console.log(used)');
  });

  it('transform removes unreachable code after return', () => {
    const section = makeSection(
      `function example() {
  return 42;
  const dead = "unreachable";
}`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('return 42;');
    expect(result.refined).not.toContain('dead');
  });

  it('transform removes duplicate consecutive lines', () => {
    const section = makeSection(
      `console.log("processing item");
console.log("processing item");
doWork();`,
    );
    const result = rule.transform(section);
    // Should keep only one occurrence
    const occurrences = result.refined.split('console.log("processing item")').length - 1;
    expect(occurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ts.clarity.no-nested-ternary (Req 4.3)
// ---------------------------------------------------------------------------

describe('ts.clarity.no-nested-ternary', () => {
  const rule = findRule('ts.clarity.no-nested-ternary');

  it('matches nested ternary operators', () => {
    const section = makeSection(
      `const result = a ? b : c ? d : e;`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches deeply nested ternary', () => {
    const section = makeSection(
      `const val = x > 0 ? "positive" : x < 0 ? "negative" : "zero";`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match simple (non-nested) ternary', () => {
    const section = makeSection(
      `const result = condition ? valueA : valueB;`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match code without ternaries', () => {
    const section = makeSection(
      `if (a) { doA(); } else { doB(); }`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation has correct ruleId', () => {
    const section = makeSection(`const x = a ? b : c ? d : e;`);
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.ruleId).toBe('ts.clarity.no-nested-ternary');
  });

  it('transform converts nested ternary to if/else', () => {
    const section = makeSection(
      `const result = a ? b : c ? d : e;`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('let result');
    expect(result.refined).toContain('if');
    expect(result.refined).toContain('else');
  });

  it('transform produces valid if/else structure', () => {
    const section = makeSection(
      `const status = x > 0 ? "positive" : x < 0 ? "negative" : "zero";`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('let status');
    expect(result.refined).toContain('if (x > 0)');
    expect(result.refined).toContain('"positive"');
    expect(result.refined).toContain('"negative"');
    expect(result.refined).toContain('"zero"');
  });
});

// ---------------------------------------------------------------------------
// ts.clarity.consolidate-logic (Req 4.4)
// ---------------------------------------------------------------------------

describe('ts.clarity.consolidate-logic', () => {
  const rule = findRule('ts.clarity.consolidate-logic');

  it('matches scattered variable usage with 3+ unrelated lines between', () => {
    const section = makeSection(
      `const total = 0;
doUnrelatedA();
doUnrelatedB();
doUnrelatedC();
console.log(total);`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match when variable is used immediately after declaration', () => {
    const section = makeSection(
      `const total = 0;
console.log(total);`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match when gap is less than 3 lines', () => {
    const section = makeSection(
      `const value = compute();
doSomething();
doAnother();
console.log(value);`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation description mentions the scattered variable name', () => {
    const section = makeSection(
      `const config = loadConfig();
stepA();
stepB();
stepC();
applyConfig(config);`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('config');
  });

  it('transform adds TODO comment suggesting consolidation', () => {
    const section = makeSection(
      `const data = fetch();
processA();
processB();
processC();
use(data);`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('TODO');
    expect(result.refined).toContain('data');
  });

  it('transform preserves all original code lines', () => {
    const section = makeSection(
      `const items = getItems();
unrelatedA();
unrelatedB();
unrelatedC();
render(items);`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('const items = getItems()');
    expect(result.refined).toContain('unrelatedA()');
    expect(result.refined).toContain('render(items)');
  });
});

// ---------------------------------------------------------------------------
// ts.clarity.remove-restating-comments (Req 4.5, 4.6)
// ---------------------------------------------------------------------------

describe('ts.clarity.remove-restating-comments', () => {
  const rule = findRule('ts.clarity.remove-restating-comments');

  it('matches comment that restates the next line of code', () => {
    const section = makeSection(
      `// log the error message
log(error, message);`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches comment that mirrors function call', () => {
    const section = makeSection(
      `// fetch data from the api
const data = fetch(api);`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match comment that adds context/rationale', () => {
    const section = makeSection(
      `// Workaround for Safari bug #12345
element.style.transform = 'translateZ(0)';`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match code without comments', () => {
    const section = makeSection(
      `const x = 1;
const y = 2;`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match comment on the last line (no next line to compare)', () => {
    const section = makeSection(`// standalone comment`);
    expect(rule.match(section)).toBeNull();
  });

  it('transform removes restating comment', () => {
    const section = makeSection(
      `// log the error message
log(error, message);
doOtherWork();`,
    );
    const result = rule.transform(section);
    expect(result.refined).not.toContain('// log the error message');
    expect(result.refined).toContain('log(error, message)');
    expect(result.refined).toContain('doOtherWork()');
  });

  it('transform preserves meaningful comments', () => {
    const section = makeSection(
      `// Workaround for Safari rendering bug
element.style.transform = 'translateZ(0)';
// fetch data from the api
const data = fetch(api);`,
    );
    const result = rule.transform(section);
    // Meaningful comment preserved
    expect(result.refined).toContain('Workaround for Safari');
    // Restating comment removed
    expect(result.refined).not.toContain('// fetch data from the api');
    expect(result.refined).toContain('const data = fetch(api)');
  });

  it('transform preserves all non-comment code lines', () => {
    const section = makeSection(
      `// send error response to client
send(error, response, client);`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('send(error, response, client)');
    expect(result.refined).not.toContain('// send error response to client');
  });
});
