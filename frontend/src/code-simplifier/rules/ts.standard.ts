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
// Rule: ts.standard.es-modules
// Detect require() calls and module.exports, suggest ES module syntax.
// Requirement 2.1
// ---------------------------------------------------------------------------

const REQUIRE_PATTERN = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORTS_DOT_PATTERN = /exports\.(\w+)\s*=/g;

const esModulesRule: Rule = {
  id: 'ts.standard.es-modules',
  language: 'typescript',
  category: 'standard',
  priority: 1,

  match(section: CodeSection): RuleViolation | null {
    const hasRequire = /\brequire\s*\(/.test(section.content);
    const hasModuleExports = /\bmodule\.exports\b/.test(section.content);
    const hasExportsDot = /\bexports\.\w+\s*=/.test(section.content);

    if (!hasRequire && !hasModuleExports && !hasExportsDot) return null;

    return makeViolation(
      this.id,
      section,
      'Use ES module import/export syntax instead of require()/module.exports',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;

    // Convert require() → import
    refined = refined.replace(REQUIRE_PATTERN, "import $1 from '$2'");

    // Convert module.exports = { ... } → export { ... } or export default
    refined = refined.replace(/module\.exports\s*=\s*/, 'export default ');

    // Convert exports.name = value → export const name = value
    refined = refined.replace(EXPORTS_DOT_PATTERN, 'export const $1 =');

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.standard.import-sort
// Detect unsorted imports, suggest reordering: external → internal → relative.
// Requirement 2.2
// ---------------------------------------------------------------------------

const IMPORT_LINE_PATTERN = /^import\s+.*from\s+['"]([^'"]+)['"];?\s*$/;

function classifyImport(specifier: string): 'external' | 'internal' | 'relative' {
  if (specifier.startsWith('.')) return 'relative';
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) return 'internal';
  // Scoped packages like @org/pkg are external
  if (specifier.startsWith('@') && !specifier.startsWith('@/')) return 'external';
  // Bare specifiers (no path prefix) are external
  return 'external';
}

function sortImports(importLines: string[]): string {
  const groups: { external: string[]; internal: string[]; relative: string[] } = {
    external: [],
    internal: [],
    relative: [],
  };

  for (const line of importLines) {
    const match = line.match(IMPORT_LINE_PATTERN);
    if (match) {
      const category = classifyImport(match[1]);
      groups[category].push(line);
    }
  }

  // Sort within each group alphabetically
  groups.external.sort();
  groups.internal.sort();
  groups.relative.sort();

  const result: string[] = [];
  if (groups.external.length > 0) result.push(groups.external.join('\n'));
  if (groups.internal.length > 0) result.push(groups.internal.join('\n'));
  if (groups.relative.length > 0) result.push(groups.relative.join('\n'));

  return result.join('\n\n');
}

const importSortRule: Rule = {
  id: 'ts.standard.import-sort',
  language: 'typescript',
  category: 'standard',
  priority: 2,

  match(section: CodeSection): RuleViolation | null {
    const lines = section.content.split('\n');
    const importLines = lines.filter((l) => IMPORT_LINE_PATTERN.test(l.trim()));

    if (importLines.length < 2) return null;

    const sorted = sortImports(importLines);

    // Extract the current import block (imports + blank lines between them)
    const firstImportIdx = lines.findIndex((l) => IMPORT_LINE_PATTERN.test(l.trim()));
    let lastImportIdx = firstImportIdx;
    for (let i = lines.length - 1; i >= firstImportIdx; i--) {
      if (IMPORT_LINE_PATTERN.test(lines[i].trim())) {
        lastImportIdx = i;
        break;
      }
    }
    const currentBlock = lines.slice(firstImportIdx, lastImportIdx + 1).join('\n');

    if (sorted === currentBlock) return null;

    return makeViolation(
      this.id,
      section,
      'Import statements should be sorted: external → internal → relative, separated by blank lines',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const lines = section.content.split('\n');
    const importLines: string[] = [];
    const nonImportBefore: string[] = [];
    const nonImportAfter: string[] = [];
    let pastImports = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!pastImports && IMPORT_LINE_PATTERN.test(trimmed)) {
        importLines.push(trimmed);
      } else if (importLines.length === 0) {
        nonImportBefore.push(line);
      } else {
        // Skip blank lines between imports (we'll re-add them)
        if (!pastImports && trimmed === '') continue;
        pastImports = true;
        nonImportAfter.push(line);
      }
    }

    const sorted = sortImports(importLines);
    const parts: string[] = [];
    if (nonImportBefore.length > 0) parts.push(nonImportBefore.join('\n'));
    parts.push(sorted);
    if (nonImportAfter.length > 0) parts.push(nonImportAfter.join('\n'));

    const refined = parts.join('\n\n');
    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.standard.function-keyword
// Detect arrow function expressions assigned to variables, suggest function keyword.
// Requirement 2.3
// ---------------------------------------------------------------------------

const ARROW_FN_PATTERN = /^(export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>{]+))?\s*=>\s*\{/gm;

const functionKeywordRule: Rule = {
  id: 'ts.standard.function-keyword',
  language: 'typescript',
  category: 'standard',
  priority: 3,

  match(section: CodeSection): RuleViolation | null {
    // Reset lastIndex for global regex
    ARROW_FN_PATTERN.lastIndex = 0;
    if (!ARROW_FN_PATTERN.test(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'Use the function keyword for named function declarations instead of arrow function expressions',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const refined = section.content.replace(
      /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>{]+))?\s*=>\s*\{/gm,
      (_match, exportKw, name, asyncKw, params, returnType) => {
        const exp = exportKw ? exportKw : '';
        const async_ = asyncKw ? asyncKw : '';
        const ret = returnType ? `: ${returnType.trim()} ` : ' ';
        return `${exp}${async_}function ${name}(${params})${ret}{`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.standard.explicit-return-types
// Detect exported functions without return type annotations.
// Requirement 2.4
// ---------------------------------------------------------------------------

const EXPORTED_FN_NO_RETURN = /^export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/gm;

const explicitReturnTypesRule: Rule = {
  id: 'ts.standard.explicit-return-types',
  language: 'typescript',
  category: 'standard',
  priority: 4,

  match(section: CodeSection): RuleViolation | null {
    EXPORTED_FN_NO_RETURN.lastIndex = 0;
    const noReturnMatches = section.content.match(EXPORTED_FN_NO_RETURN) ?? [];

    // Filter out those that already have return types
    const missing = noReturnMatches.filter((m) => {
      return !/\)\s*:/.test(m);
    });

    if (missing.length === 0) return null;

    return makeViolation(
      this.id,
      section,
      'Exported functions should have explicit return type annotations',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    // Add a void return type placeholder where missing — the developer should refine it
    const refined = section.content.replace(
      /^(export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\))\s*\{/gm,
      (match, signature) => {
        // Already has a return type
        if (/\)\s*:/.test(signature)) return match;
        return `${signature}: void {`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.standard.component-declaration
// Detect React components not using named function declarations.
// Requirement 2.5
// ---------------------------------------------------------------------------

// Matches: const ComponentName = (props) => { ... } or const ComponentName: React.FC = ...
const ARROW_COMPONENT_PATTERN = /^(export\s+)?const\s+([A-Z]\w+)\s*(?::\s*React\.FC[^=]*)?\s*=\s*(?:async\s+)?\(([^)]*)\)(?:\s*:\s*[^=>{]+)?\s*=>\s*\{/gm;

const componentDeclarationRule: Rule = {
  id: 'ts.standard.component-declaration',
  language: 'typescript',
  category: 'standard',
  priority: 5,

  match(section: CodeSection): RuleViolation | null {
    ARROW_COMPONENT_PATTERN.lastIndex = 0;
    if (!ARROW_COMPONENT_PATTERN.test(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'React components should be defined as named function declarations',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    const refined = section.content.replace(
      /^(export\s+)?const\s+([A-Z]\w+)\s*(?::\s*React\.FC[^=]*)?\s*=\s*(async\s+)?\(([^)]*)\)(?:\s*:\s*([^=>{]+))?\s*=>\s*\{/gm,
      (_match, exportKw, name, asyncKw, params, returnType) => {
        const exp = exportKw ? exportKw : '';
        const async_ = asyncKw ? asyncKw : '';
        const ret = returnType ? `: ${returnType.trim()} ` : ' ';
        return `${exp}${async_}function ${name}(${params})${ret}{`;
      },
    );

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Rule: ts.standard.props-interface
// Detect React component props using inline types instead of interfaces.
// Requirement 2.6
// ---------------------------------------------------------------------------

// Matches function declarations with inline object type for props:
// function MyComponent({ foo, bar }: { foo: string; bar: number }) {
const INLINE_PROPS_PATTERN = /function\s+([A-Z]\w+)\s*\(\s*(?:\{[^}]*\}|\w+)\s*:\s*\{([^}]+)\}\s*\)/g;

const propsInterfaceRule: Rule = {
  id: 'ts.standard.props-interface',
  language: 'typescript',
  category: 'standard',
  priority: 6,

  match(section: CodeSection): RuleViolation | null {
    INLINE_PROPS_PATTERN.lastIndex = 0;
    if (!INLINE_PROPS_PATTERN.test(section.content)) return null;

    return makeViolation(
      this.id,
      section,
      'Component props should be defined using a TypeScript interface instead of inline type annotations',
      this.transform(section).refined,
    );
  },

  transform(section: CodeSection): Transformation {
    let refined = section.content;
    const interfaces: string[] = [];

    refined = refined.replace(
      /function\s+([A-Z]\w+)\s*\(\s*(\{[^}]*\}|\w+)\s*:\s*\{([^}]+)\}\s*\)/g,
      (_match, componentName, paramName, inlineProps) => {
        const interfaceName = `${componentName}Props`;
        interfaces.push(`interface ${interfaceName} {\n  ${inlineProps.trim()}\n}`);
        return `function ${componentName}(${paramName}: ${interfaceName})`;
      },
    );

    // Prepend interfaces before the component
    if (interfaces.length > 0) {
      refined = interfaces.join('\n\n') + '\n\n' + refined;
    }

    return makeTransformation(this.id, section, refined);
  },
};

// ---------------------------------------------------------------------------
// Export all TypeScript standard rules
// ---------------------------------------------------------------------------

export const tsStandardRules: Rule[] = [
  esModulesRule,
  importSortRule,
  functionKeywordRule,
  explicitReturnTypesRule,
  componentDeclarationRule,
  propsInterfaceRule,
];
