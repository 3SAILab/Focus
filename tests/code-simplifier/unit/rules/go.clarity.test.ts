import { describe, it, expect } from 'vitest';
import { goClarityRules } from '../../../../frontend/src/code-simplifier/rules/go.clarity';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'backend/example.go'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = goClarityRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('goClarityRules array', () => {
  it('exports all 3 clarity rules', () => {
    expect(goClarityRules).toHaveLength(3);
  });

  it('all rules have language go and category clarity', () => {
    for (const rule of goClarityRules) {
      expect(rule.language).toBe('go');
      expect(rule.category).toBe('clarity');
    }
  });

  it('all rules have unique ids', () => {
    const ids = goClarityRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rules have priority >= 10', () => {
    for (const rule of goClarityRules) {
      expect(rule.priority).toBeGreaterThanOrEqual(10);
    }
  });

  it('rules are ordered by priority', () => {
    for (let i = 1; i < goClarityRules.length; i++) {
      expect(goClarityRules[i].priority).toBeGreaterThan(goClarityRules[i - 1].priority);
    }
  });
});

// ---------------------------------------------------------------------------
// go.clarity.guard-clauses (Req 4.1)
// ---------------------------------------------------------------------------

describe('go.clarity.guard-clauses', () => {
  const rule = findRule('go.clarity.guard-clauses');

  it('matches deeply nested if/else blocks (3+ levels)', () => {
    const section = makeSection(
      `func process(x int) {
  if x > 0 {
    if x < 100 {
      if x != 50 {
        doSomething()
      }
    }
  }
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches else blocks containing nested if', () => {
    const section = makeSection(
      `func handle(a int) {
  if a > 0 {
    doA()
  } else {
    if a < 0 {
      doB()
    }
  }
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match simple if without deep nesting', () => {
    const section = makeSection(
      `func check(x int) bool {
  if x > 0 {
    return true
  }
  return false
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match flat if/else (no nesting)', () => {
    const section = makeSection(
      `if a > 0 {
  doA()
} else {
  doB()
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation has correct ruleId and severity', () => {
    const section = makeSection(
      `func f() {
  if a > 0 {
    if b > 0 {
      if c > 0 {
        return 1
      }
    }
  }
}`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.ruleId).toBe('go.clarity.guard-clauses');
    expect(violation!.severity).toBe('clarity');
  });

  it('transform converts if/else with early return into guard clause', () => {
    const section = makeSection(
      `if condition {
  return early
} else {
  doWork()
}`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('return early');
    expect(result.refined).not.toContain('} else {');
  });

  it('transform preserves filePath and line info', () => {
    const section = makeSection(
      'if a {\n  if b {\n    if c { return }\n  }\n}',
      'backend/deep.go',
    );
    const result = rule.transform(section);
    expect(result.filePath).toBe('backend/deep.go');
    expect(result.startLine).toBe(section.startLine);
    expect(result.endLine).toBe(section.endLine);
  });
});

// ---------------------------------------------------------------------------
// go.clarity.remove-redundancy (Req 4.2)
// ---------------------------------------------------------------------------

describe('go.clarity.remove-redundancy', () => {
  const rule = findRule('go.clarity.remove-redundancy');

  it('matches unused variables (short declaration)', () => {
    const section = makeSection(
      `func doWork() {
  unused := 42
  fmt.Println("hello")
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches unreachable code after return', () => {
    const section = makeSection(
      `func example() int {
  return 42
  fmt.Println("unreachable")
}`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches duplicate logic (identical lines)', () => {
    const section = makeSection(
      `fmt.Println("processing item")
doSomething()
fmt.Println("processing item")`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match when all variables are used', () => {
    const section = makeSection(
      `value := compute()
fmt.Println(value)`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match code without redundancy', () => {
    const section = makeSection(
      `func add(a int, b int) int {
  return a + b
}`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation description mentions unused variables by name', () => {
    const section = makeSection(
      `orphan := "never used"
doWork()`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('orphan');
  });

  it('transform removes unused short variable declarations', () => {
    const section = makeSection(
      `unused := 42
used := 10
fmt.Println(used)`,
    );
    const result = rule.transform(section);
    expect(result.refined).not.toContain('unused');
    expect(result.refined).toContain('used');
  });

  it('transform removes duplicate consecutive lines', () => {
    const section = makeSection(
      `fmt.Println("processing item")
fmt.Println("processing item")
doWork()`,
    );
    const result = rule.transform(section);
    const occurrences = result.refined.split('fmt.Println("processing item")').length - 1;
    expect(occurrences).toBe(1);
  });

  it('does not flag err as unused', () => {
    const section = makeSection(
      `err := doSomething()
fmt.Println("done")`,
    );
    // err is excluded from unused detection
    expect(rule.match(section)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// go.clarity.consolidate-logic (Req 4.4)
// ---------------------------------------------------------------------------

describe('go.clarity.consolidate-logic', () => {
  const rule = findRule('go.clarity.consolidate-logic');

  it('matches scattered variable usage with 3+ unrelated lines between', () => {
    const section = makeSection(
      `total := 0
doUnrelatedA()
doUnrelatedB()
doUnrelatedC()
fmt.Println(total)`,
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match when variable is used immediately after declaration', () => {
    const section = makeSection(
      `total := 0
fmt.Println(total)`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match when gap is less than 3 lines', () => {
    const section = makeSection(
      `value := compute()
doSomething()
doAnother()
fmt.Println(value)`,
    );
    expect(rule.match(section)).toBeNull();
  });

  it('violation description mentions the scattered variable name', () => {
    const section = makeSection(
      `config := loadConfig()
stepA()
stepB()
stepC()
applyConfig(config)`,
    );
    const violation = rule.match(section);
    expect(violation).not.toBeNull();
    expect(violation!.description).toContain('config');
  });

  it('transform adds TODO comment suggesting consolidation', () => {
    const section = makeSection(
      `data := fetch()
processA()
processB()
processC()
use(data)`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('TODO');
    expect(result.refined).toContain('data');
  });

  it('transform preserves all original code lines', () => {
    const section = makeSection(
      `items := getItems()
unrelatedA()
unrelatedB()
unrelatedC()
render(items)`,
    );
    const result = rule.transform(section);
    expect(result.refined).toContain('items := getItems()');
    expect(result.refined).toContain('unrelatedA()');
    expect(result.refined).toContain('render(items)');
  });

  it('does not flag err or _ variables', () => {
    const section = makeSection(
      `err := doSomething()
stepA()
stepB()
stepC()
if err != nil { return }`,
    );
    // err is excluded from scattered logic detection
    expect(rule.match(section)).toBeNull();
  });
});
