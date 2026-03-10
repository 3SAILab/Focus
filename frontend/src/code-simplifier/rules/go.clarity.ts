import type { Rule, CodeSection, RuleViolation, Transformation } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(
  ruleId: string,
  section: CodeSection,
  description: string,
  refined: string,
): RuleViolation {
  return {
    ruleId,
    severity: 'clarity',
    location: section,
    description,
    suggestedFix: {
      ruleId,
      filePath: section.filePath,
      original: section.content,
      refined,
      startLine: section.startLine,
      endLine: section.endLine,
    },
  };
}

function makeTransformation(
  ruleId: string,
  section: CodeSection,
  refined: string,
): Transformation {
  return {
    ruleId,
    filePath: section.filePath,
    original: section.content,
    refined,
    startLine: section.startLine,
    endLine: section.endLine,
  };
}

// ---------------------------------------------------------------------------
// Rule: go.clarity.guard-clauses
// Detect deeply nested if/else in Go, suggest guard clauses.
// Requirement 4.1
// ---------------------------------------------------------------------------

const NESTED_IF_ELSE_PATTERN = /if\s+[^{]*\{[^}]*if\s+[^{]*\{/;
const ELSE_WITH_NESTED_IF = /\}\s*else\s*\{[^}]*\bif\s+/;
const DEEP_NESTING_THRESHOLD = 3;

function getNestingDepth(content: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  for (const ch of content) {
    if (ch === '{') {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    } else if (ch === '}') {
      currentDepth--;
    }
  }
  return maxDepth;
}

function hasDeepIfElseNesting(content: string): boolean {
  const hasIfElse = NESTED_IF_ELSE_PATTERN.test(content) || ELSE_WITH_NESTED_IF.test(content);
  if (!hasIfElse) return false;
  return getNestingDepth(content) >= DEEP_NESTING_THRESHOLD;
}

function convertGoToGuardClauses(content: string): string {
  // Convert if/else where the if-branch returns into a guard clause
  let refined = content.replace(
    /if\s+([^{]+)\{(\s*return\s[^}]*)\}\s*else\s*\{([^}]*)\}/g,
    (_match, condition, returnBody, elseBody) => {
      return `if ${condition.trim()} {${returnBody}}\n${elseBody.trim()}`;
    },
  );

  // Convert if err != nil { ... } else { ... } into early return
  refined = refined.replace(
    /if\s+(err\s*!=\s*nil)\s*\{([^}]*)\}\s*else\s*\{([^}]*)\}/g,
    (_match, condition, errorBlock, mainBlock) => {
      const trimmedError = errorBlock.trim();
      const trimmedMain = mainBlock.trim();
      const hasReturn = /\breturn\b/.test(trimmedError);
      const errorBody = hasReturn ? trimmedError : `${trimmedError}\n\t\treturn`;
      return `if ${condition} {\n\t\t${errorBody}\n\t}\n\t${trimmedMain}`;
    },
  );

  return refined;
}

const guardClausesRule: Rule = {
  id: 'go.clarity.guard-clauses',
  language: 'go',
  category: 'clarity',
  priority: 10,

  match(section: CodeSection): RuleViolation | null {
    if (!hasDeepIfElseNesting(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'Deeply nested if/else blocks detected in Go code. Consider using guard clauses and early returns to reduce nesting depth.',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const refined = convertGoToGuardClauses(section.content);
    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: go.clarity.remove-redundancy
// Detect unused variables, unreachable code in Go.
// Requirement 4.2
// ---------------------------------------------------------------------------

const GO_VAR_DECL_PATTERN = /(?:var\s+(\w+)\s|(\w+)\s*:=)/g;
const GO_UNREACHABLE_AFTER_RETURN = /\breturn\b[^;\n]*\n([ \t]+\S[^\n]*)/g;

function findGoUnusedVariables(content: string): string[] {
  const unused: string[] = [];
  const declarations: string[] = [];

  GO_VAR_DECL_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GO_VAR_DECL_PATTERN.exec(content)) !== null) {
    const name = m[1] || m[2];
    if (name && name !== '_' && name !== 'err') {
      declarations.push(name);
    }
  }

  for (const name of declarations) {
    const nameRegex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = content.match(nameRegex);
    if (matches && matches.length === 1) {
      unused.push(name);
    }
  }

  return unused;
}

function hasGoUnreachableCode(content: string): boolean {
  GO_UNREACHABLE_AFTER_RETURN.lastIndex = 0;
  return GO_UNREACHABLE_AFTER_RETURN.test(content);
}

function hasGoDuplicateLogic(content: string): boolean {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && l !== '{' && l !== '}');
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.length > 10 && seen.has(line)) return true;
    seen.add(line);
  }
  return false;
}

const removeRedundancyRule: Rule = {
  id: 'go.clarity.remove-redundancy',
  language: 'go',
  category: 'clarity',
  priority: 11,

  match(section: CodeSection): RuleViolation | null {
    const unusedVars = findGoUnusedVariables(section.content);
    const unreachable = hasGoUnreachableCode(section.content);
    const duplicate = hasGoDuplicateLogic(section.content);

    if (unusedVars.length === 0 && !unreachable && !duplicate) return null;

    const issues: string[] = [];
    if (unusedVars.length > 0) issues.push(`unused variables: ${unusedVars.join(', ')}`);
    if (unreachable) issues.push('unreachable code after return');
    if (duplicate) issues.push('duplicate logic');

    return makeViolation(
      this.id,
      section,
      `Redundant code detected in Go: ${issues.join('; ')}`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Remove unused variable declarations (short var decl)
    const unusedVars = findGoUnusedVariables(refined);
    for (const varName of unusedVars) {
      // Remove short variable declarations: varName := ...
      const shortDeclPattern = new RegExp(
        `^[ \\t]*${varName}\\s*:=[^\\n]*\\n?`,
        'gm',
      );
      refined = refined.replace(shortDeclPattern, '');

      // Remove var declarations: var varName ...
      const varDeclPattern = new RegExp(
        `^[ \\t]*var\\s+${varName}\\s[^\\n]*\\n?`,
        'gm',
      );
      refined = refined.replace(varDeclPattern, '');
    }

    // Remove unreachable code after return statements
    refined = refined.replace(
      /(\breturn\b[^\n]*\n)([ \t]+\S[^\n]*\n?)(?=[ \t]*\})/g,
      '$1',
    );

    // Remove duplicate consecutive lines
    const lines = refined.split('\n');
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
      if (trimmed.length > 10 && trimmed === prevTrimmed) continue;
      result.push(lines[i]);
    }
    refined = result.join('\n');

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: go.clarity.consolidate-logic
// Detect scattered related logic in Go.
// Requirement 4.4
// ---------------------------------------------------------------------------

function findGoScatteredLogic(content: string): Array<{ varName: string; declLine: number; useLine: number; gap: number }> {
  const lines = content.split('\n');
  const scattered: Array<{ varName: string; declLine: number; useLine: number; gap: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    // Match Go variable declarations: var x = ... or x := ...
    const declMatch = lines[i].match(/(?:var\s+(\w+)\s*=|(\w+)\s*:=)/);
    if (!declMatch) continue;

    const varName = declMatch[1] || declMatch[2];
    if (!varName || varName === '_' || varName === 'err') continue;

    const nameRegex = new RegExp(`\\b${varName}\\b`);

    let nextUseLine = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (nameRegex.test(lines[j])) {
        nextUseLine = j;
        break;
      }
    }

    if (nextUseLine === -1) continue;

    let gapLines = 0;
    for (let k = i + 1; k < nextUseLine; k++) {
      const trimmed = lines[k].trim();
      if (trimmed && trimmed !== '{' && trimmed !== '}') gapLines++;
    }

    if (gapLines >= 3) {
      scattered.push({ varName, declLine: i, useLine: nextUseLine, gap: gapLines });
    }
  }

  return scattered;
}

const consolidateLogicRule: Rule = {
  id: 'go.clarity.consolidate-logic',
  language: 'go',
  category: 'clarity',
  priority: 12,

  match(section: CodeSection): RuleViolation | null {
    const scattered = findGoScatteredLogic(section.content);
    if (scattered.length === 0) return null;

    const names = scattered.map((s) => s.varName).join(', ');
    return makeViolation(
      this.id,
      section,
      `Related logic for [${names}] is scattered across non-adjacent lines in Go code. Consider grouping related operations together.`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const scattered = findGoScatteredLogic(section.content);
    let refined = section.content;

    if (scattered.length > 0) {
      const lines = refined.split('\n');
      for (const s of scattered) {
        const indent = lines[s.declLine].match(/^(\s*)/)?.[1] ?? '';
        lines[s.declLine] = `${indent}// TODO: Consider moving related '${s.varName}' logic together\n${lines[s.declLine]}`;
      }
      refined = lines.join('\n');
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Export all Go clarity rules
// ---------------------------------------------------------------------------

export const goClarityRules: Rule[] = [
  guardClausesRule,
  removeRedundancyRule,
  consolidateLogicRule,
];
