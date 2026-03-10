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
// Rule: ts.clarity.guard-clauses
// Detect deeply nested if/else blocks, suggest guard clauses and early returns.
// Requirement 4.1
// ---------------------------------------------------------------------------

// Matches if blocks that contain else blocks with significant nesting (3+ levels)
const NESTED_IF_ELSE_PATTERN = /if\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*\)\s*\{/;
// Detects } else { ... if pattern indicating deep nesting
const ELSE_WITH_NESTED_IF = /\}\s*else\s*\{[^}]*\bif\s*\(/;
// Counts nesting depth by tracking braces within if/else chains
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
  // Check for if/else chains with nesting depth >= threshold
  const hasIfElse = NESTED_IF_ELSE_PATTERN.test(content) || ELSE_WITH_NESTED_IF.test(content);
  if (!hasIfElse) return false;
  return getNestingDepth(content) >= DEEP_NESTING_THRESHOLD;
}

/**
 * Attempts to convert a simple if-else-return pattern into a guard clause.
 * Handles the pattern:
 *   if (condition) {
 *     return earlyValue;
 *   } else {
 *     // rest
 *   }
 * →
 *   if (condition) {
 *     return earlyValue;
 *   }
 *   // rest
 */
function convertToGuardClauses(content: string): string {
  // Convert if/else where the if-branch returns into a guard clause
  let refined = content.replace(
    /if\s*(\([^)]*\))\s*\{(\s*return\s[^}]*)\}\s*else\s*\{([^}]*)\}/g,
    (_match, condition, returnBody, elseBody) => {
      return `if ${condition} {${returnBody}}\n${elseBody.trim()}`;
    },
  );

  // Convert if/else where the else-branch returns into a guard clause (invert)
  refined = refined.replace(
    /if\s*(\([^)]*\))\s*\{([^}]*)\}\s*else\s*\{(\s*return\s[^}]*)\}/g,
    (_match, condition, ifBody, returnBody) => {
      // Only invert if the if-body doesn't also return
      if (/\breturn\b/.test(ifBody)) return _match;
      return `if (!${condition.slice(1)}{${returnBody}}\n${ifBody.trim()}`;
    },
  );

  return refined;
}

const guardClausesRule: Rule = {
  id: 'ts.clarity.guard-clauses',
  language: 'typescript',
  category: 'clarity',
  priority: 10,

  match(section: CodeSection): RuleViolation | null {
    if (!hasDeepIfElseNesting(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'Deeply nested if/else blocks detected. Consider using guard clauses and early returns to reduce nesting depth.',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const refined = convertToGuardClauses(section.content);
    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.clarity.remove-redundancy
// Detect unused variables, unreachable code, duplicate logic.
// Requirement 4.2
// ---------------------------------------------------------------------------

// Matches variable declarations
const VAR_DECL_PATTERN = /(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/g;
// Matches code after a return statement within the same block
const UNREACHABLE_AFTER_RETURN = /\breturn\b[^;]*;[ \t]*\n([ \t]+\S[^\n]*)/g;

function findUnusedVariables(content: string): string[] {
  const unused: string[] = [];
  const declarations: Array<{ name: string; index: number }> = [];

  VAR_DECL_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VAR_DECL_PATTERN.exec(content)) !== null) {
    declarations.push({ name: m[1], index: m.index });
  }

  for (const decl of declarations) {
    // Count occurrences of the variable name as a whole word
    const nameRegex = new RegExp(`\\b${decl.name}\\b`, 'g');
    const matches = content.match(nameRegex);
    // If it only appears once (the declaration itself), it's unused
    if (matches && matches.length === 1) {
      unused.push(decl.name);
    }
  }

  return unused;
}

function hasUnreachableCode(content: string): boolean {
  UNREACHABLE_AFTER_RETURN.lastIndex = 0;
  return UNREACHABLE_AFTER_RETURN.test(content);
}

function hasDuplicateLogic(content: string): boolean {
  // Detect duplicate consecutive lines (excluding blank lines and braces)
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l && l !== '{' && l !== '}');
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.length > 10 && seen.has(line)) return true;
    seen.add(line);
  }
  return false;
}

const removeRedundancyRule: Rule = {
  id: 'ts.clarity.remove-redundancy',
  language: 'typescript',
  category: 'clarity',
  priority: 11,

  match(section: CodeSection): RuleViolation | null {
    const unusedVars = findUnusedVariables(section.content);
    const unreachable = hasUnreachableCode(section.content);
    const duplicate = hasDuplicateLogic(section.content);

    if (unusedVars.length === 0 && !unreachable && !duplicate) return null;

    const issues: string[] = [];
    if (unusedVars.length > 0) issues.push(`unused variables: ${unusedVars.join(', ')}`);
    if (unreachable) issues.push('unreachable code after return');
    if (duplicate) issues.push('duplicate logic');

    return makeViolation(
      this.id,
      section,
      `Redundant code detected: ${issues.join('; ')}`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Remove unused variable declarations
    const unusedVars = findUnusedVariables(refined);
    for (const varName of unusedVars) {
      const pattern = new RegExp(
        `^[ \\t]*(?:const|let|var)\\s+${varName}\\s*(?::[^=]+)?\\s*=[^;]*;[ \\t]*\\n?`,
        'gm',
      );
      refined = refined.replace(pattern, '');
    }

    // Remove unreachable code after return statements
    refined = refined.replace(
      /(\breturn\b[^;]*;[ \t]*\n)([ \t]+\S[^\n]*\n?)(?=[ \t]*\})/g,
      '$1',
    );

    // Remove duplicate consecutive lines (keeping first occurrence)
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
// Rule: ts.clarity.no-nested-ternary
// Detect nested ternary operators, suggest if/else.
// Requirement 4.3
// ---------------------------------------------------------------------------

// Detect two or more ? operators in the same expression (nested ternary)
const TERNARY_IN_TERNARY = /\?[^?]*\?/;

const noNestedTernaryRule: Rule = {
  id: 'ts.clarity.no-nested-ternary',
  language: 'typescript',
  category: 'clarity',
  priority: 12,

  match(section: CodeSection): RuleViolation | null {
    if (!TERNARY_IN_TERNARY.test(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'Nested ternary operators detected. Replace with if/else statements or extracted helper functions for clarity.',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Replace nested ternary assignments:
    // const x = a ? b : c ? d : e;
    // → let x; if (a) { x = b; } else if (c) { x = d; } else { x = e; }
    refined = refined.replace(
      /(?:const|let)\s+(\w+)\s*=\s*([^?;\n]+)\?\s*([^:;\n]+)\s*:\s*([^?;\n]+)\?\s*([^:;\n]+)\s*:\s*([^;\n]+);/g,
      (_match, varName, cond1, val1, cond2, val2, val3) => {
        const c1 = cond1.trim();
        const v1 = val1.trim();
        const c2 = cond2.trim();
        const v2 = val2.trim();
        const v3 = val3.trim();
        return `let ${varName};\nif (${c1}) {\n  ${varName} = ${v1};\n} else if (${c2}) {\n  ${varName} = ${v2};\n} else {\n  ${varName} = ${v3};\n}`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.clarity.consolidate-logic
// Detect scattered related logic, suggest grouping.
// Requirement 4.4
// ---------------------------------------------------------------------------

/**
 * Detects when related variable operations are scattered across non-adjacent lines.
 * For example, a variable is declared, then unrelated code appears, then the variable
 * is used/modified — suggesting the related logic should be grouped together.
 */
function findScatteredLogic(content: string): Array<{ varName: string; declLine: number; useLine: number; gap: number }> {
  const lines = content.split('\n');
  const scattered: Array<{ varName: string; declLine: number; useLine: number; gap: number }> = [];

  // Find variable declarations and their next usage
  for (let i = 0; i < lines.length; i++) {
    const declMatch = lines[i].match(/(?:const|let|var)\s+(\w+)\s*=/);
    if (!declMatch) continue;

    const varName = declMatch[1];
    const nameRegex = new RegExp(`\\b${varName}\\b`);

    // Find next usage after declaration (skip blank lines)
    let nextUseLine = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (nameRegex.test(lines[j])) {
        nextUseLine = j;
        break;
      }
    }

    if (nextUseLine === -1) continue;

    // Count non-blank, non-brace lines between declaration and usage
    let gapLines = 0;
    for (let k = i + 1; k < nextUseLine; k++) {
      const trimmed = lines[k].trim();
      if (trimmed && trimmed !== '{' && trimmed !== '}') gapLines++;
    }

    // If there are 3+ unrelated lines between declaration and usage, it's scattered
    if (gapLines >= 3) {
      scattered.push({ varName, declLine: i, useLine: nextUseLine, gap: gapLines });
    }
  }

  return scattered;
}

const consolidateLogicRule: Rule = {
  id: 'ts.clarity.consolidate-logic',
  language: 'typescript',
  category: 'clarity',
  priority: 13,

  match(section: CodeSection): RuleViolation | null {
    const scattered = findScatteredLogic(section.content);
    if (scattered.length === 0) return null;

    const names = scattered.map((s) => s.varName).join(', ');
    return makeViolation(
      this.id,
      section,
      `Related logic for [${names}] is scattered across non-adjacent lines. Consider grouping related operations together.`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    // For consolidation, we add a comment suggesting grouping rather than
    // auto-rearranging (which could change semantics). The transform marks
    // the scattered variables with a grouping suggestion.
    const scattered = findScatteredLogic(section.content);
    let refined = section.content;

    if (scattered.length > 0) {
      const lines = refined.split('\n');
      // Add a hint comment above the first scattered declaration
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
// Rule: ts.clarity.remove-restating-comments
// Detect comments that merely restate what the code does without adding
// context or rationale.
// Requirements 4.5, 4.6
// ---------------------------------------------------------------------------

/**
 * Heuristic: a comment is "restating" if it closely mirrors the code on the
 * next line. We compare normalized tokens from the comment against the code.
 */
function isRestatingComment(commentText: string, codeLine: string): boolean {
  // Normalize: lowercase, strip punctuation, split into words
  const normalize = (s: string): string[] =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

  const commentWords = normalize(commentText);
  const codeWords = normalize(codeLine);

  if (commentWords.length === 0 || codeWords.length === 0) return false;

  // Count how many comment words appear in the code line
  let overlap = 0;
  for (const word of commentWords) {
    if (codeWords.includes(word)) overlap++;
  }

  // If more than 50% of comment words are found in the code, it's restating
  const ratio = overlap / commentWords.length;
  return ratio > 0.5;
}

const SINGLE_LINE_COMMENT = /^(\s*)\/\/\s*(.+)$/;

const removeRestatingCommentsRule: Rule = {
  id: 'ts.clarity.remove-restating-comments',
  language: 'typescript',
  category: 'clarity',
  priority: 14,

  match(section: CodeSection): RuleViolation | null {
    const lines = section.content.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const commentMatch = lines[i].match(SINGLE_LINE_COMMENT);
      if (!commentMatch) continue;

      const commentText = commentMatch[2];
      const nextLine = lines[i + 1];

      if (isRestatingComment(commentText, nextLine)) {
        return makeViolation(
          this.id,
          section,
          'Comment restates what the code does. Remove comments that don\'t add context or rationale.',
          this.transform(section).refined,
        );
      }
    }
    return null;
  },

  transform(section: CodeSection): Transformation {
    const lines = section.content.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const commentMatch = lines[i].match(SINGLE_LINE_COMMENT);
      if (commentMatch && i < lines.length - 1) {
        const commentText = commentMatch[2];
        const nextLine = lines[i + 1];
        if (isRestatingComment(commentText, nextLine)) {
          // Skip this comment line
          continue;
        }
      }
      result.push(lines[i]);
    }

    return makeTransformation(this.id, section, result.join('\n'));
  },
};

// ---------------------------------------------------------------------------
// Export all TypeScript clarity rules
// ---------------------------------------------------------------------------

export const tsClarityRules: Rule[] = [
  guardClausesRule,
  removeRedundancyRule,
  noNestedTernaryRule,
  consolidateLogicRule,
  removeRestatingCommentsRule,
];
