import { describe, it, expect } from 'vitest';
import {
  DefaultBehaviorPreservationValidator,
  extractFunctionSignatures,
  extractErrorHandlingPatterns,
  extractSideEffects,
  countFunctions,
  extractIntermediateVariables,
  countMaxNesting,
  hasComplexFunctionalChains,
  evaluateBalanceChecks,
} from '../../../frontend/src/code-simplifier/validators/behaviorValidator';
import type { Transformation, CodeSection } from '../../../frontend/src/code-simplifier/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTransformation(original: string, refined: string): Transformation {
  return {
    ruleId: 'test.rule',
    filePath: 'src/test.ts',
    original,
    refined,
    startLine: 1,
    endLine: 10,
  };
}

function makeContext(content: string): CodeSection {
  return {
    filePath: 'src/test.ts',
    startLine: 1,
    endLine: 10,
    content,
  };
}

// ---------------------------------------------------------------------------
// extractFunctionSignatures
// ---------------------------------------------------------------------------

describe('extractFunctionSignatures', () => {
  it('extracts TypeScript function declarations', () => {
    const code = 'function greet(name: string): void {\n  console.log(name);\n}';
    const sigs = extractFunctionSignatures(code);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]).toContain('greet');
    expect(sigs[0]).toContain('(name: string)');
  });

  it('extracts exported async functions', () => {
    const code = 'export async function fetchData(url: string): Promise<Response> {\n  return fetch(url);\n}';
    const sigs = extractFunctionSignatures(code);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]).toContain('fetchData');
  });

  it('extracts Go function declarations', () => {
    const code = 'func HandleRequest(w http.ResponseWriter, r *http.Request) error {\n}';
    const sigs = extractFunctionSignatures(code);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]).toContain('HandleRequest');
  });

  it('extracts Go method declarations', () => {
    const code = 'func (s *Server) Start(port int) error {\n}';
    const sigs = extractFunctionSignatures(code);
    expect(sigs).toHaveLength(1);
    expect(sigs[0]).toContain('Start');
  });

  it('returns empty array for code with no functions', () => {
    const code = 'const x = 42;\nconst y = "hello";';
    expect(extractFunctionSignatures(code)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractErrorHandlingPatterns
// ---------------------------------------------------------------------------

describe('extractErrorHandlingPatterns', () => {
  it('extracts try/catch patterns', () => {
    const code = 'try {\n  doSomething();\n} catch (err) {\n  handleError(err);\n}';
    const patterns = extractErrorHandlingPatterns(code);
    expect(patterns).toContain('catch(err)');
  });

  it('extracts Go error checks', () => {
    const code = 'if err != nil {\n  return err\n}';
    const patterns = extractErrorHandlingPatterns(code);
    expect(patterns).toContain('if err != nil');
  });

  it('extracts promise .catch()', () => {
    const code = 'fetch(url).then(res => res.json()).catch(err => console.error(err));';
    const patterns = extractErrorHandlingPatterns(code);
    expect(patterns).toContain('.catch(');
  });

  it('extracts throw statements', () => {
    const code = 'throw new Error("something went wrong");';
    const patterns = extractErrorHandlingPatterns(code);
    expect(patterns).toContain('throw');
  });

  it('extracts Go error return patterns', () => {
    const code = 'return fmt.Errorf("failed: %w", err)';
    const patterns = extractErrorHandlingPatterns(code);
    expect(patterns.some((p) => p.includes('return fmt.Errorf'))).toBe(true);
  });

  it('returns empty array for code with no error handling', () => {
    const code = 'const x = 1 + 2;';
    expect(extractErrorHandlingPatterns(code)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractSideEffects
// ---------------------------------------------------------------------------

describe('extractSideEffects', () => {
  it('detects console.log calls', () => {
    const code = 'console.log("hello");';
    expect(extractSideEffects(code)).toHaveLength(1);
  });

  it('detects fetch calls', () => {
    const code = 'const res = fetch("/api/data");';
    expect(extractSideEffects(code)).toHaveLength(1);
  });

  it('detects setState calls', () => {
    const code = 'setState({ loading: true });';
    expect(extractSideEffects(code)).toHaveLength(1);
  });

  it('preserves order of multiple side effects', () => {
    const code = 'console.log("start");\nfetch("/api");\nconsole.log("end");';
    const effects = extractSideEffects(code);
    expect(effects).toHaveLength(3);
    expect(effects[0]).toContain('console.log("start")');
    expect(effects[2]).toContain('console.log("end")');
  });

  it('skips comment lines', () => {
    const code = '// console.log("commented out");\nconsole.log("real");';
    const effects = extractSideEffects(code);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toContain('console.log("real")');
  });

  it('returns empty array for pure code', () => {
    const code = 'const x = 1 + 2;\nconst y = x * 3;';
    expect(extractSideEffects(code)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// countFunctions
// ---------------------------------------------------------------------------

describe('countFunctions', () => {
  it('counts TypeScript function declarations', () => {
    const code = 'function foo() {}\nfunction bar() {}';
    expect(countFunctions(code)).toBe(2);
  });

  it('counts Go function declarations', () => {
    const code = 'func main() {\n}\nfunc helper() {\n}';
    expect(countFunctions(code)).toBe(2);
  });

  it('returns 0 for code with no functions', () => {
    expect(countFunctions('const x = 42;')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractIntermediateVariables
// ---------------------------------------------------------------------------

describe('extractIntermediateVariables', () => {
  it('extracts named intermediate variables', () => {
    const code = 'const total = price + tax;\nconst formatted = `$${total}`;';
    const vars = extractIntermediateVariables(code);
    expect(vars).toContain('total');
    expect(vars).toContain('formatted');
  });

  it('excludes function declarations', () => {
    const code = 'const handler = function() { return 1; };';
    expect(extractIntermediateVariables(code)).toEqual([]);
  });

  it('excludes arrow function assignments', () => {
    const code = 'const handler = (x: number) => x * 2;';
    expect(extractIntermediateVariables(code)).toEqual([]);
  });

  it('returns empty for code with no variable assignments', () => {
    expect(extractIntermediateVariables('console.log("hello");')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// countMaxNesting
// ---------------------------------------------------------------------------

describe('countMaxNesting', () => {
  it('counts nesting depth correctly', () => {
    const code = 'if (x) {\n  if (y) {\n    doSomething();\n  }\n}';
    expect(countMaxNesting(code)).toBe(2);
  });

  it('returns 0 for flat code', () => {
    expect(countMaxNesting('const x = 1;')).toBe(0);
  });

  it('handles deeply nested code', () => {
    const code = '{ { { { } } } }';
    expect(countMaxNesting(code)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// hasComplexFunctionalChains
// ---------------------------------------------------------------------------

describe('hasComplexFunctionalChains', () => {
  it('detects chains of 4+ method calls', () => {
    const code = 'arr.map(x => x).filter(x => x).reduce((a, b) => a + b).toString()';
    expect(hasComplexFunctionalChains(code)).toBe(true);
  });

  it('allows chains of 3 or fewer', () => {
    const code = 'arr.map(x => x).filter(x => x).join(",")';
    expect(hasComplexFunctionalChains(code)).toBe(false);
  });

  it('returns false for non-chained code', () => {
    expect(hasComplexFunctionalChains('const x = 1;')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateBalanceChecks
// ---------------------------------------------------------------------------

describe('evaluateBalanceChecks', () => {
  it('passes all checks when code is unchanged', () => {
    const code = 'function foo() {\n  const x = 1;\n  return x;\n}';
    const check = evaluateBalanceChecks(code, code);
    expect(check.preservesAbstractions).toBe(true);
    expect(check.noUnrelatedCombining).toBe(true);
    expect(check.noComplexFunctionalChains).toBe(true);
    expect(check.preservesIntermediateVars).toBe(true);
    expect(check.readabilityNotReduced).toBe(true);
  });

  it('fails preservesAbstractions when functions are removed', () => {
    const original = 'function foo() {}\nfunction bar() {}';
    const refined = 'function fooBar() {}';
    const check = evaluateBalanceChecks(original, refined);
    expect(check.preservesAbstractions).toBe(false);
  });

  it('fails noComplexFunctionalChains when chains are introduced', () => {
    const original = 'const result = items.filter(x => x > 0);';
    const refined = 'const result = items.map(x => x).filter(x => x > 0).reduce((a, b) => a + b, 0).toString();';
    const check = evaluateBalanceChecks(original, refined);
    expect(check.noComplexFunctionalChains).toBe(false);
  });

  it('passes noComplexFunctionalChains when chains already existed', () => {
    const code = 'const result = items.map(x => x).filter(x => x > 0).reduce((a, b) => a + b, 0).toString();';
    const check = evaluateBalanceChecks(code, code);
    expect(check.noComplexFunctionalChains).toBe(true);
  });

  it('fails preservesIntermediateVars when variables are inlined', () => {
    const original = 'const total = price + tax;\nconst formatted = `$${total}`;';
    const refined = 'const formatted = `$${price + tax}`;';
    const check = evaluateBalanceChecks(original, refined);
    expect(check.preservesIntermediateVars).toBe(false);
  });

  it('fails readabilityNotReduced when nesting increases', () => {
    const original = 'if (x) {\n  doA();\n}';
    const refined = 'if (x) {\n  if (y) {\n    doA();\n  }\n}';
    const check = evaluateBalanceChecks(original, refined);
    expect(check.readabilityNotReduced).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DefaultBehaviorPreservationValidator
// ---------------------------------------------------------------------------

describe('DefaultBehaviorPreservationValidator', () => {
  const validator = new DefaultBehaviorPreservationValidator();

  it('returns safe for identical code', () => {
    const code = 'function foo() { return 1; }';
    const t = makeTransformation(code, code);
    const result = validator.validate(t, makeContext(code));
    expect(result.safe).toBe(true);
  });

  it('returns safe for a valid simplification', () => {
    const original = 'function greet(name: string): string {\n  const msg = "Hello " + name;\n  return msg;\n}';
    const refined = 'function greet(name: string): string {\n  const msg = `Hello ${name}`;\n  return msg;\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(true);
  });

  it('rejects when function signature is changed', () => {
    const original = 'function greet(name: string): string {\n  return "Hello " + name;\n}';
    const refined = 'function greet(name: string, age: number): string {\n  return "Hello " + name;\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('rejects when function is renamed', () => {
    const original = 'function processData(input: string): void {\n  console.log(input);\n}';
    const refined = 'function handleData(input: string): void {\n  console.log(input);\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('signature');
  });

  it('rejects when error handling is removed', () => {
    const original = 'try {\n  doSomething();\n} catch (err) {\n  handleError(err);\n}';
    const refined = 'doSomething();';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Error handling');
  });

  it('rejects when side-effect order changes', () => {
    const original = 'console.log("first");\nfetch("/api");\nconsole.log("second");';
    const refined = 'fetch("/api");\nconsole.log("first");\nconsole.log("second");';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('Side-effect');
  });

  it('rejects when return statements are removed', () => {
    const original = 'if (x) {\n  return 1;\n} else {\n  return 2;\n}';
    const refined = 'if (x) {\n  return 1;\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('code path');
  });

  it('rejects when conditional branches are removed', () => {
    const original = 'if (a) {\n  doA();\n} else if (b) {\n  doB();\n} else {\n  doC();\n}';
    const refined = 'if (a) {\n  doA();\n} else {\n  doC();\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
  });

  it('rejects when abstractions are reduced', () => {
    const original = 'function validate(x: number): boolean {\n  return x > 0;\n}\nfunction process(x: number): boolean {\n  return validate(x);\n}';
    const refined = 'function process(x: number): boolean {\n  return x > 0;\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
  });

  it('rejects when complex functional chains are introduced', () => {
    const original = 'const result = items.filter(x => x > 0);';
    const refined = 'const result = items.map(x => x).filter(x => x > 0).reduce((a, b) => a + b, 0).toString();';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('functional chains');
  });

  it('rejects when intermediate variables are inlined', () => {
    const original = 'const total = price + tax;\nconst formatted = `$${total}`;';
    const refined = 'const formatted = `$${price + tax}`;';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('intermediate variables');
  });

  it('rejects when nesting depth increases', () => {
    const original = 'if (x) {\n  doA();\n  return;\n}';
    const refined = 'if (x) {\n  if (y) {\n    doA();\n    return;\n  }\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('readability');
  });

  it('preserves Go error handling patterns', () => {
    const original = 'result, err := doSomething()\nif err != nil {\n  return err\n}';
    const refined = 'result, err := doSomething()\nif err != nil {\n  return err\n}';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(true);
  });

  it('rejects when Go error handling is removed', () => {
    const original = 'result, err := doSomething()\nif err != nil {\n  return err\n}';
    const refined = 'result, _ := doSomething()';
    const t = makeTransformation(original, refined);
    const result = validator.validate(t, makeContext(original));
    expect(result.safe).toBe(false);
  });
});
