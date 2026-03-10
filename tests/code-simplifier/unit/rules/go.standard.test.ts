import { describe, it, expect } from 'vitest';
import { goStandardRules } from '../../../../frontend/src/code-simplifier/rules/go.standard';
import type { CodeSection } from '../../../../frontend/src/code-simplifier/types';

function makeSection(content: string, filePath = 'backend/example.go'): CodeSection {
  return { filePath, startLine: 1, endLine: 10, content };
}

function findRule(id: string) {
  const rule = goStandardRules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

describe('goStandardRules array', () => {
  it('exports all 4 standard rules', () => {
    expect(goStandardRules).toHaveLength(4);
  });

  it('all rules have language go and category standard', () => {
    for (const rule of goStandardRules) {
      expect(rule.language).toBe('go');
      expect(rule.category).toBe('standard');
    }
  });

  it('all rules have unique ids', () => {
    const ids = goStandardRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('rules are ordered by priority', () => {
    for (let i = 1; i < goStandardRules.length; i++) {
      expect(goStandardRules[i].priority).toBeGreaterThan(goStandardRules[i - 1].priority);
    }
  });
});

// ---------------------------------------------------------------------------
// go.standard.naming
// ---------------------------------------------------------------------------

describe('go.standard.naming', () => {
  const rule = findRule('go.standard.naming');

  it('matches exported snake_case identifiers', () => {
    const section = makeSection('func Get_User_Name() string {\n\treturn ""\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches unexported snake_case identifiers', () => {
    const section = makeSection('func get_user_name() string {\n\treturn ""\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches snake_case var declarations', () => {
    const section = makeSection('var my_var = 10');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match proper camelCase unexported', () => {
    const section = makeSection('func getUserName() string {\n\treturn ""\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match proper PascalCase exported', () => {
    const section = makeSection('func GetUserName() string {\n\treturn ""\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms exported snake_case to PascalCase', () => {
    const section = makeSection('func Get_User() string {\n\treturn ""\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('func GetUser()');
    expect(result.refined).not.toContain('Get_User');
  });

  it('transforms unexported snake_case to camelCase', () => {
    const section = makeSection('func get_user() string {\n\treturn ""\n}');
    const result = rule.transform(section);
    expect(result.refined).toContain('func getUser()');
    expect(result.refined).not.toContain('get_user');
  });

  it('transforms const snake_case', () => {
    const section = makeSection('const max_retries = 3');
    const result = rule.transform(section);
    expect(result.refined).toContain('const maxRetries');
  });
});

// ---------------------------------------------------------------------------
// go.standard.error-handling
// ---------------------------------------------------------------------------

describe('go.standard.error-handling', () => {
  const rule = findRule('go.standard.error-handling');

  it('matches ignored error with underscore', () => {
    const section = makeSection('  result, _ := json.Marshal(data)');
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches ignored error with blank identifier in assignment', () => {
    const section = makeSection('  file, _ := os.Open("test.txt")');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match properly handled errors', () => {
    const section = makeSection('  result, err := json.Marshal(data)\n  if err != nil {\n    return err\n  }');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match simple variable assignments', () => {
    const section = makeSection('  x := 42\n  y := "hello"');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms ignored error to checked error', () => {
    const section = makeSection('  result, _ := json.Marshal(data)');
    const result = rule.transform(section);
    expect(result.refined).toContain('result, err :=');
    expect(result.refined).toContain('if err != nil');
    expect(result.refined).toContain('return err');
  });
});

// ---------------------------------------------------------------------------
// go.standard.early-returns
// ---------------------------------------------------------------------------

describe('go.standard.early-returns', () => {
  const rule = findRule('go.standard.early-returns');

  it('matches error check with else block', () => {
    const section = makeSection(
      'if err != nil {\n\tlog.Println(err)\n} else {\n\tprocess(result)\n}',
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('matches err == nil wrapping pattern', () => {
    const section = makeSection('if err == nil {\n\tprocess(result)\n}');
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match early return pattern', () => {
    const section = makeSection(
      'if err != nil {\n\treturn err\n}\nprocess(result)',
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match code without error handling', () => {
    const section = makeSection('x := 42\nfmt.Println(x)');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms else block into early return pattern', () => {
    const section = makeSection(
      'if err != nil {\n\tlog.Println(err)\n} else {\n\tprocess(result)\n}',
    );
    const result = rule.transform(section);
    expect(result.refined).not.toContain('} else {');
    expect(result.refined).toContain('process(result)');
  });
});

// ---------------------------------------------------------------------------
// go.standard.import-grouping
// ---------------------------------------------------------------------------

describe('go.standard.import-grouping', () => {
  const rule = findRule('go.standard.import-grouping');

  it('matches ungrouped imports', () => {
    const section = makeSection(
      'import (\n\t"github.com/gin-gonic/gin"\n\t"fmt"\n\t"net/http"\n)',
    );
    expect(rule.match(section)).not.toBeNull();
  });

  it('does not match single import', () => {
    const section = makeSection('import (\n\t"fmt"\n)');
    expect(rule.match(section)).toBeNull();
  });

  it('does not match already grouped imports', () => {
    const section = makeSection(
      'import (\n\t"fmt"\n\t"net/http"\n\n\t"github.com/gin-gonic/gin"\n)',
    );
    expect(rule.match(section)).toBeNull();
  });

  it('does not match non-import code', () => {
    const section = makeSection('func main() {\n\tfmt.Println("hello")\n}');
    expect(rule.match(section)).toBeNull();
  });

  it('transforms ungrouped imports into grouped format', () => {
    const section = makeSection(
      'import (\n\t"github.com/gin-gonic/gin"\n\t"fmt"\n\t"net/http"\n)',
    );
    const result = rule.transform(section);
    const lines = result.refined.split('\n');

    // stdlib should come first
    const fmtIdx = lines.findIndex((l) => l.includes('"fmt"'));
    const ginIdx = lines.findIndex((l) => l.includes('gin'));
    expect(fmtIdx).toBeLessThan(ginIdx);
  });

  it('groups stdlib before external packages', () => {
    const section = makeSection(
      'import (\n\t"github.com/pkg/errors"\n\t"os"\n\t"fmt"\n)',
    );
    const result = rule.transform(section);
    const lines = result.refined.split('\n');

    const fmtIdx = lines.findIndex((l) => l.includes('"fmt"'));
    const osIdx = lines.findIndex((l) => l.includes('"os"'));
    const errorsIdx = lines.findIndex((l) => l.includes('errors'));
    expect(fmtIdx).toBeLessThan(errorsIdx);
    expect(osIdx).toBeLessThan(errorsIdx);
  });

  it('separates groups with blank lines', () => {
    const section = makeSection(
      'import (\n\t"github.com/gin-gonic/gin"\n\t"fmt"\n)',
    );
    const result = rule.transform(section);
    // Should have a blank line between stdlib and external (with tab indentation)
    expect(result.refined).toMatch(/"fmt"\n\t\n\t"/);
  });
});
