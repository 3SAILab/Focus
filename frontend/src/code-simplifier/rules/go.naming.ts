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
    severity: 'standard',
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
// Rule: go.naming.descriptive
// Detect single-letter variables except idiomatic Go (i, j, k, n, err).
// Requirement 9.4
// ---------------------------------------------------------------------------

/**
 * Idiomatic Go single-letter names that are allowed:
 * - Loop indices: i, j, k, n
 * - Error variable: err
 * - Common short names in range clauses: v, k (key/value)
 */
const GO_IDIOMATIC_SHORT_NAMES = new Set(['i', 'j', 'k', 'n', 'err']);

function findGoSingleLetterViolations(content: string): string[] {
  const violations: string[] = [];
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // Check if this is a for loop line (indices are allowed)
    const isForLoop = /^\s*for\s+/.test(line);

    // Check short variable declarations: x := ...
    const shortDeclPattern = /\b([a-zA-Z])\s*:=/g;
    let match;
    while ((match = shortDeclPattern.exec(line)) !== null) {
      const name = match[1];
      if (isForLoop && GO_IDIOMATIC_SHORT_NAMES.has(name)) continue;
      if (GO_IDIOMATIC_SHORT_NAMES.has(name)) continue;
      violations.push(name);
    }

    // Check var declarations: var x int
    const varDeclPattern = /\bvar\s+([a-zA-Z])\s+/g;
    while ((match = varDeclPattern.exec(line)) !== null) {
      const name = match[1];
      if (GO_IDIOMATIC_SHORT_NAMES.has(name)) continue;
      violations.push(name);
    }

    // Check function parameters: func foo(x int, y string)
    const funcParamPattern = /func\s+\w*\s*\(([^)]*)\)/;
    const funcMatch = trimmed.match(funcParamPattern);
    if (funcMatch) {
      const paramList = funcMatch[1];
      const params = paramList.split(',');
      for (const param of params) {
        const paramTrimmed = param.trim();
        const paramNameMatch = paramTrimmed.match(/^([a-zA-Z])\s+/);
        if (paramNameMatch) {
          const name = paramNameMatch[1];
          if (!GO_IDIOMATIC_SHORT_NAMES.has(name)) {
            violations.push(name);
          }
        }
      }
    }

    // Check range clause variables: for k, v := range ...
    // k and v are idiomatic in range clauses, so skip them
    const rangePattern = /for\s+(\w+)\s*,\s*(\w+)\s*:=\s*range/;
    const rangeMatch = trimmed.match(rangePattern);
    if (rangeMatch) {
      // Remove k, v from violations if they were added from the range clause
      const rangeKey = rangeMatch[1];
      const rangeVal = rangeMatch[2];
      const rangeIdiomatic = new Set(['k', 'v', 'i', 'j', '_']);
      if (rangeIdiomatic.has(rangeKey)) {
        const idx = violations.indexOf(rangeKey);
        if (idx !== -1) violations.splice(idx, 1);
      }
      if (rangeIdiomatic.has(rangeVal)) {
        const idx = violations.indexOf(rangeVal);
        if (idx !== -1) violations.splice(idx, 1);
      }
    }
  }

  return [...new Set(violations)];
}

const descriptiveRule: Rule = {
  id: 'go.naming.descriptive',
  language: 'go',
  category: 'naming',
  priority: 20,

  match(section: CodeSection): RuleViolation | null {
    const violations = findGoSingleLetterViolations(section.content);
    if (violations.length === 0) return null;

    return makeViolation(
      this.id,
      section,
      `Single-letter variable names found in Go code: ${violations.join(', ')}. Use descriptive names (idiomatic exceptions: i, j, k, n, err).`,
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;
    const violations = findGoSingleLetterViolations(section.content);

    if (violations.length > 0) {
      const comment = `// TODO: Rename single-letter variables to descriptive names: ${violations.join(', ')}`;
      refined = comment + '\n' + refined;
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Export all Go naming rules
// ---------------------------------------------------------------------------

export const goNamingRules: Rule[] = [
  descriptiveRule,
];
