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
// Rule: go.standard.naming
// Detect non-standard Go naming: camelCase for unexported, PascalCase for exported.
// Requirement 3.1
// ---------------------------------------------------------------------------

// Matches exported identifiers (func/type/var/const at package level) that use
// snake_case or other non-PascalCase patterns.
const EXPORTED_SNAKE_CASE = /^(?:func|type|var|const)\s+([A-Z][a-zA-Z0-9]*_[a-zA-Z0-9_]*)\b/gm;

// Matches unexported identifiers that use PascalCase (start with uppercase) when
// they should be unexported (lowercase first letter) — detected via context.
// Also catches snake_case in unexported identifiers.
const UNEXPORTED_WRONG_CASE = /^(?:func|var|const)\s+([a-z][a-zA-Z0-9]*_[a-zA-Z0-9_]*)\b/gm;

// Detect unexported func/var/const with ALL_CAPS naming (non-idiomatic Go)
const UNEXPORTED_ALL_CAPS = /^(?:var|const)\s+([A-Z][A-Z_0-9]+)\s/gm;

function snakeToCamel(name: string): string {
  return name.replace(/_([a-zA-Z])/g, (_, letter) => letter.toUpperCase());
}

const namingRule: Rule = {
  id: 'go.standard.naming',
  language: 'go',
  category: 'standard',
  priority: 1,

  match(section: CodeSection): RuleViolation | null {
    EXPORTED_SNAKE_CASE.lastIndex = 0;
    UNEXPORTED_WRONG_CASE.lastIndex = 0;
    UNEXPORTED_ALL_CAPS.lastIndex = 0;

    const hasExportedSnake = EXPORTED_SNAKE_CASE.test(section.content);
    EXPORTED_SNAKE_CASE.lastIndex = 0;

    const hasUnexportedSnake = UNEXPORTED_WRONG_CASE.test(section.content);
    UNEXPORTED_WRONG_CASE.lastIndex = 0;

    const hasAllCaps = UNEXPORTED_ALL_CAPS.test(section.content);
    UNEXPORTED_ALL_CAPS.lastIndex = 0;

    if (!hasExportedSnake && !hasUnexportedSnake && !hasAllCaps) return null;

    return makeViolation(
      this.id,
      section,
      'Go identifiers should use camelCase for unexported and PascalCase for exported names (no snake_case)',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Convert exported snake_case to PascalCase
    refined = refined.replace(
      /^((?:func|type|var|const)\s+)([A-Z][a-zA-Z0-9]*_[a-zA-Z0-9_]*)\b/gm,
      (_, prefix, name) => {
        const pascal = snakeToCamel(name);
        return `${prefix}${pascal}`;
      },
    );

    // Convert unexported snake_case to camelCase
    refined = refined.replace(
      /^((?:func|var|const)\s+)([a-z][a-zA-Z0-9]*_[a-zA-Z0-9_]*)\b/gm,
      (_, prefix, name) => {
        const camel = snakeToCamel(name);
        return `${prefix}${camel}`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: go.standard.error-handling
// Detect unchecked error return values.
// Requirement 3.2
// ---------------------------------------------------------------------------

// Matches function calls whose error return is discarded, e.g.:
//   result := someFunc(args)   — when someFunc returns (T, error)
// We look for common patterns where error is explicitly ignored:
//   val, _ := someFunc(...)
const IGNORED_ERROR_PATTERN = /(\w+)\s*,\s*_\s*:?=\s*\w+[\w.]*\s*\(/g;

// Also detect bare calls that likely return errors but aren't captured:
//   someFunc(args)  — on its own line, no assignment
// We limit to known patterns like os.*, http.*, json.*, io.*, fmt.F*
const BARE_ERROR_CALL = /^\s+((?:os|http|json|io|fmt\.F)\w*\.\w+\s*\([^)]*\))\s*$/gm;

const errorHandlingRule: Rule = {
  id: 'go.standard.error-handling',
  language: 'go',
  category: 'standard',
  priority: 2,

  match(section: CodeSection): RuleViolation | null {
    IGNORED_ERROR_PATTERN.lastIndex = 0;
    BARE_ERROR_CALL.lastIndex = 0;

    const hasIgnored = IGNORED_ERROR_PATTERN.test(section.content);
    IGNORED_ERROR_PATTERN.lastIndex = 0;

    const hasBareCall = BARE_ERROR_CALL.test(section.content);
    BARE_ERROR_CALL.lastIndex = 0;

    if (!hasIgnored && !hasBareCall) return null;

    return makeViolation(
      this.id,
      section,
      'Error return values must be checked and handled at every call site',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Replace `val, _ := fn(...)` with `val, err := fn(...)` + error check
    refined = refined.replace(
      /^(\s*)(\w+)\s*,\s*_\s*(:?=)\s*(\w[\w.]*\s*\([^)]*\))/gm,
      (_, indent, val, assign, call) => {
        return `${indent}${val}, err ${assign} ${call}\n${indent}if err != nil {\n${indent}\treturn err\n${indent}}`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: go.standard.early-returns
// Detect error handling without early returns (nested else blocks after error checks).
// Requirement 3.3
// ---------------------------------------------------------------------------

// Matches patterns like:
//   if err != nil {
//     ...
//   } else {
//     ... (main logic)
//   }
// These should use early return instead.
const ERROR_ELSE_PATTERN = /if\s+err\s*!=\s*nil\s*\{[^}]*\}\s*else\s*\{/g;

// Also detect deeply nested error handling:
//   if err == nil { ... main logic ... }
const ERR_NIL_WRAP = /if\s+err\s*==\s*nil\s*\{/g;

const earlyReturnsRule: Rule = {
  id: 'go.standard.early-returns',
  language: 'go',
  category: 'standard',
  priority: 3,

  match(section: CodeSection): RuleViolation | null {
    ERROR_ELSE_PATTERN.lastIndex = 0;
    ERR_NIL_WRAP.lastIndex = 0;

    const hasElse = ERROR_ELSE_PATTERN.test(section.content);
    ERROR_ELSE_PATTERN.lastIndex = 0;

    const hasNilWrap = ERR_NIL_WRAP.test(section.content);
    ERR_NIL_WRAP.lastIndex = 0;

    if (!hasElse && !hasNilWrap) return null;

    return makeViolation(
      this.id,
      section,
      'Use early returns for error conditions to reduce nesting depth',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Transform: if err != nil { <error> } else { <main> }
    // Into:      if err != nil { <error>\n  return ... }  \n <main>
    refined = refined.replace(
      /if\s+err\s*!=\s*nil\s*\{([^}]*)\}\s*else\s*\{([^}]*)\}/g,
      (_, errorBlock, mainBlock) => {
        const trimmedError = errorBlock.trim();
        const trimmedMain = mainBlock.trim();
        // If error block doesn't already have a return, add one
        const hasReturn = /\breturn\b/.test(trimmedError);
        const errorBody = hasReturn ? trimmedError : `${trimmedError}\n\t\treturn`;
        return `if err != nil {\n\t\t${errorBody}\n\t}\n\t${trimmedMain}`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: go.standard.import-grouping
// Detect ungrouped imports (stdlib → external → internal).
// Requirement 3.4
// ---------------------------------------------------------------------------

// Standard library packages (common ones)
const GO_STDLIB_PREFIXES = [
  'archive', 'bufio', 'bytes', 'compress', 'container', 'context', 'crypto',
  'database', 'debug', 'embed', 'encoding', 'errors', 'expvar', 'flag',
  'fmt', 'go', 'hash', 'html', 'image', 'index', 'io', 'log', 'maps',
  'math', 'mime', 'net', 'os', 'path', 'plugin', 'reflect', 'regexp',
  'runtime', 'slices', 'sort', 'strconv', 'strings', 'sync', 'syscall',
  'testing', 'text', 'time', 'unicode', 'unsafe',
];

function classifyGoImport(pkg: string): 'stdlib' | 'external' | 'internal' {
  // Remove quotes
  const cleaned = pkg.replace(/"/g, '').trim();

  // Standard library: no dots in the first path segment
  const firstSegment = cleaned.split('/')[0];
  if (GO_STDLIB_PREFIXES.includes(firstSegment)) return 'stdlib';

  // Internal packages typically start with the module name (contain a dot in first segment)
  // or use a relative-like path. We treat packages with a domain-like first segment as external
  // unless they match the project's module path.
  if (firstSegment.includes('.')) return 'external';

  // Fallback: treat as stdlib if no dots
  return 'stdlib';
}

const IMPORT_BLOCK_PATTERN = /import\s*\(([\s\S]*?)\)/;
const SINGLE_IMPORT_PATTERN = /^\s*"([^"]+)"\s*$/;

function parseImportBlock(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => SINGLE_IMPORT_PATTERN.test(l));
}

function groupGoImports(importLines: string[]): string {
  const groups: { stdlib: string[]; external: string[]; internal: string[] } = {
    stdlib: [],
    external: [],
    internal: [],
  };

  for (const line of importLines) {
    const match = line.match(SINGLE_IMPORT_PATTERN);
    if (match) {
      const category = classifyGoImport(match[1]);
      groups[category].push(line);
    }
  }

  groups.stdlib.sort();
  groups.external.sort();
  groups.internal.sort();

  const result: string[] = [];
  if (groups.stdlib.length > 0) result.push(groups.stdlib.join('\n'));
  if (groups.external.length > 0) result.push(groups.external.join('\n'));
  if (groups.internal.length > 0) result.push(groups.internal.join('\n'));

  return result.join('\n\n');
}

const importGroupingRule: Rule = {
  id: 'go.standard.import-grouping',
  language: 'go',
  category: 'standard',
  priority: 4,

  match(section: CodeSection): RuleViolation | null {
    const blockMatch = section.content.match(IMPORT_BLOCK_PATTERN);
    if (!blockMatch) return null;

    const importLines = parseImportBlock(blockMatch[1]);
    if (importLines.length < 2) return null;

    // Compare just the ordered import lines (ignoring blank-line formatting)
    const grouped = groupGoImports(importLines);
    const groupedLines = grouped.split('\n').filter((l) => l.trim() !== '');
    const currentLines = importLines.map((l) => l.trim());

    if (groupedLines.join('\n') === currentLines.join('\n')) return null;

    return makeViolation(
      this.id,
      section,
      'Go imports should be grouped: standard library → external packages → internal packages, separated by blank lines',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    refined = refined.replace(IMPORT_BLOCK_PATTERN, (_, block) => {
      const importLines = parseImportBlock(block);
      if (importLines.length < 2) return `import (\n${block}\n)`;

      const grouped = groupGoImports(importLines);
      return `import (\n\t${grouped.replace(/\n/g, '\n\t')}\n)`;
    });

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Export all Go standard rules
// ---------------------------------------------------------------------------

export const goStandardRules: Rule[] = [
  namingRule,
  errorHandlingRule,
  earlyReturnsRule,
  importGroupingRule,
];
