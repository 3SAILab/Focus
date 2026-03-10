import type {
  BehaviorPreservationValidator,
  Transformation,
  CodeSection,
  ValidationResult,
  BalanceCheck,
} from '../types';

// ---------------------------------------------------------------------------
// Regex helpers for text-based analysis
// ---------------------------------------------------------------------------

/** Extract function signatures (name, params, return type) from code text. */
function extractFunctionSignatures(code: string): string[] {
  const signatures: string[] = [];

  // TypeScript / JavaScript: function declarations, exported functions, methods
  // Matches: export function foo(a: string, b: number): void
  //          function bar(x: number): string
  //          async function baz(): Promise<void>
  const tsFnRegex =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(\([^)]*\))(?:\s*:\s*([^{]+?))?(?:\s*\{)/g;
  let match: RegExpExecArray | null;
  while ((match = tsFnRegex.exec(code)) !== null) {
    const name = match[1];
    const params = match[2].trim();
    const returnType = (match[3] ?? '').trim();
    signatures.push(`${name}${params}${returnType ? `:${returnType}` : ''}`);
  }

  // Arrow function exports: export const foo = (a: string): void =>
  const arrowRegex =
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(\([^)]*\))(?:\s*:\s*([^=]+?))?\s*=>/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    const name = match[1];
    const params = match[2].trim();
    const returnType = (match[3] ?? '').trim();
    signatures.push(`${name}${params}${returnType ? `:${returnType}` : ''}`);
  }

  // Go: func FuncName(params) returnType {
  const goFnRegex =
    /func\s+(?:\([^)]*\)\s+)?(\w+)\s*(\([^)]*\))(?:\s+([^{]+?))?(?:\s*\{)/g;
  while ((match = goFnRegex.exec(code)) !== null) {
    const name = match[1];
    const params = match[2].trim();
    const returnType = (match[3] ?? '').trim();
    signatures.push(`${name}${params}${returnType ? `:${returnType}` : ''}`);
  }

  return signatures;
}

/** Extract error handling patterns from code. */
function extractErrorHandlingPatterns(code: string): string[] {
  const patterns: string[] = [];

  // try/catch blocks — capture the catch clause
  const tryCatchRegex = /catch\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = tryCatchRegex.exec(code)) !== null) {
    patterns.push(`catch(${match[1].trim()})`);
  }

  // Go error checks: if err != nil
  const goErrRegex = /if\s+(\w+)\s*!=\s*nil/g;
  while ((match = goErrRegex.exec(code)) !== null) {
    patterns.push(`if ${match[1]} != nil`);
  }

  // .catch() promise chains
  const promiseCatchRegex = /\.catch\s*\(/g;
  while ((match = promiseCatchRegex.exec(code)) !== null) {
    patterns.push('.catch(');
  }

  // throw statements
  const throwRegex = /throw\s+/g;
  while ((match = throwRegex.exec(code)) !== null) {
    patterns.push('throw');
  }

  // return err / return fmt.Errorf patterns
  const returnErrRegex = /return\s+(?:fmt\.Errorf|errors\.New|err\b)/g;
  while ((match = returnErrRegex.exec(code)) !== null) {
    patterns.push(match[0].trim());
  }

  return patterns;
}

/** Known side-effect producing patterns. */
const SIDE_EFFECT_PATTERNS = [
  /console\.\w+\s*\(/,
  /fetch\s*\(/,
  /setState\s*\(/,
  /dispatch\s*\(/,
  /emit\s*\(/,
  /\.write\s*\(/,
  /\.send\s*\(/,
  /\.log\s*\(/,
  /\.warn\s*\(/,
  /\.error\s*\(/,
  /fs\.\w+\s*\(/,
  /http\.\w+\s*\(/,
  /\.push\s*\(/,
  /\.splice\s*\(/,
  /\.set\s*\(/,
  /\.delete\s*\(/,
  /document\.\w+\s*\(/,
  /window\.\w+\s*\(/,
  /localStorage\.\w+\s*\(/,
  /sessionStorage\.\w+\s*\(/,
];

/** Extract ordered side-effect statements from code. */
function extractSideEffects(code: string): string[] {
  const effects: string[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }
    for (const pattern of SIDE_EFFECT_PATTERNS) {
      if (pattern.test(trimmed)) {
        effects.push(trimmed);
        break; // Only count each line once
      }
    }
  }

  return effects;
}

/** Count function/method declarations in code. */
function countFunctions(code: string): number {
  let count = 0;

  // TS/JS function declarations
  const tsFnMatches = code.match(/(?:export\s+)?(?:async\s+)?function\s+\w+/g);
  if (tsFnMatches) count += tsFnMatches.length;

  // Arrow function assignments (const/let/var name = (...) =>)
  const arrowMatches = code.match(/(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+?)?\s*=>/g);
  if (arrowMatches) count += arrowMatches.length;

  // Go function declarations
  const goFnMatches = code.match(/func\s+(?:\([^)]*\)\s+)?\w+\s*\(/g);
  if (goFnMatches) count += goFnMatches.length;

  // Class method declarations (methodName(...) {)
  const methodMatches = code.match(/^\s+(?:async\s+)?(?:static\s+)?\w+\s*\([^)]*\)\s*(?::\s*[^{]+?)?\s*\{/gm);
  if (methodMatches) count += methodMatches.length;

  return count;
}

/** Count named intermediate variables (const/let/var assignments that aren't functions). */
function extractIntermediateVariables(code: string): string[] {
  const vars: string[] = [];
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match const/let/var assignments that are NOT function/arrow declarations
    const varMatch = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(.+)/);
    if (varMatch) {
      const name = varMatch[1];
      const value = varMatch[2];
      // Exclude function declarations (named and anonymous) and arrow functions
      if (!/(?:async\s+)?function[\s(]/.test(value) && !/(?:async\s+)?\([^)]*\)\s*=>/.test(value)) {
        vars.push(name);
      }
    }
  }

  return vars;
}

/** Count maximum nesting depth in code. */
function countMaxNesting(code: string): number {
  let maxDepth = 0;
  let currentDepth = 0;
  let inString: string | null = null;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    // Track string context to ignore braces inside strings
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (inTemplate) {
      if (char === '`') {
        inTemplate = false;
      }
      // Skip ${...} inside template literals — don't count as nesting
      if (char === '$' && i + 1 < code.length && code[i + 1] === '{') {
        // Skip the ${ and find the matching }
        i++; // skip {
        let depth = 1;
        while (i + 1 < code.length && depth > 0) {
          i++;
          if (code[i] === '{') depth++;
          else if (code[i] === '}') depth--;
        }
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = char;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === '{') {
      currentDepth++;
      if (currentDepth > maxDepth) maxDepth = currentDepth;
    } else if (char === '}') {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  return maxDepth;
}

/** Detect if code contains deeply chained functional expressions. */
function hasComplexFunctionalChains(code: string): boolean {
  // Count consecutive method calls in a chain by scanning for .name( patterns
  // We use a simpler approach: find sequences of .word( and count them
  const chainPattern = /\.\w+\s*\(/g;
  const lines = code.split('\n');

  for (const line of lines) {
    // Count method calls on a single line/expression
    const matches = line.match(chainPattern);
    if (matches && matches.length >= 4) {
      return true;
    }
  }

  return false;
}

/** Detect if code merges unrelated logic by checking for multiple distinct operations in a single expression. */
function detectsUnrelatedCombining(original: string, refined: string): boolean {
  // If the refined code has fewer statements but same line count or more,
  // it might be combining unrelated operations.
  const originalStatements = original.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;
  const refinedStatements = refined.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;

  // If refined has significantly fewer statements (more than 50% reduction)
  // while the original had multiple distinct operations, flag it
  if (originalStatements > 4 && refinedStatements < originalStatements * 0.4) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Validation checks
// ---------------------------------------------------------------------------

/** Check that public API signatures are unchanged between original and refined code. */
function checkSignaturesPreserved(original: string, refined: string): ValidationResult {
  const originalSigs = extractFunctionSignatures(original);
  const refinedSigs = extractFunctionSignatures(refined);

  // Every original signature must still exist in the refined code
  for (const sig of originalSigs) {
    if (!refinedSigs.includes(sig)) {
      return { safe: false, reason: `Public API signature changed or removed: ${sig}` };
    }
  }

  return { safe: true };
}

/** Check that error handling paths are preserved. */
function checkErrorHandlingPreserved(original: string, refined: string): ValidationResult {
  const originalPatterns = extractErrorHandlingPatterns(original);
  const refinedPatterns = extractErrorHandlingPatterns(refined);

  for (const pattern of originalPatterns) {
    if (!refinedPatterns.includes(pattern)) {
      return { safe: false, reason: `Error handling path removed or altered: ${pattern}` };
    }
  }

  return { safe: true };
}

/** Check that side-effect execution order is maintained. */
function checkSideEffectOrder(original: string, refined: string): ValidationResult {
  const originalEffects = extractSideEffects(original);
  const refinedEffects = extractSideEffects(refined);

  // All original side effects must appear in the same relative order
  let refinedIdx = 0;
  for (const effect of originalEffects) {
    let found = false;
    while (refinedIdx < refinedEffects.length) {
      if (refinedEffects[refinedIdx] === effect) {
        found = true;
        refinedIdx++;
        break;
      }
      refinedIdx++;
    }
    if (!found) {
      return { safe: false, reason: `Side-effect order changed or side-effect removed: ${effect}` };
    }
  }

  return { safe: true };
}

/** Check that no reachable code paths are removed. */
function checkNoCodePathRemoval(original: string, refined: string): ValidationResult {
  // Check that return statements are preserved
  const originalReturns = (original.match(/\breturn\b/g) ?? []).length;
  const refinedReturns = (refined.match(/\breturn\b/g) ?? []).length;

  if (refinedReturns < originalReturns) {
    return { safe: false, reason: 'Reachable code path removed: fewer return statements in refined code' };
  }

  // Check that conditional branches are preserved
  const originalBranches = (original.match(/\b(?:if|else|switch|case)\b/g) ?? []).length;
  const refinedBranches = (refined.match(/\b(?:if|else|switch|case)\b/g) ?? []).length;

  if (refinedBranches < originalBranches) {
    return { safe: false, reason: 'Reachable code path removed: fewer conditional branches in refined code' };
  }

  return { safe: true };
}

// ---------------------------------------------------------------------------
// Balance checks
// ---------------------------------------------------------------------------

/** Evaluate all balance constraints for a transformation. */
function evaluateBalanceChecks(original: string, refined: string): BalanceCheck {
  // Req 5.1: preservesAbstractions — function/module count doesn't decrease
  const originalFnCount = countFunctions(original);
  const refinedFnCount = countFunctions(refined);
  const preservesAbstractions = refinedFnCount >= originalFnCount;

  // Req 5.2: noUnrelatedCombining — doesn't merge unrelated logic
  const noUnrelatedCombining = !detectsUnrelatedCombining(original, refined);

  // Req 5.3: noComplexFunctionalChains — doesn't create deeply chained functional expressions
  const originalHasChains = hasComplexFunctionalChains(original);
  const refinedHasChains = hasComplexFunctionalChains(refined);
  // Only fail if the refined code introduces new chains that weren't in the original
  const noComplexFunctionalChains = !refinedHasChains || originalHasChains;

  // Req 5.4: preservesIntermediateVars — named intermediate variables not inlined
  const originalVars = extractIntermediateVariables(original);
  const refinedVars = extractIntermediateVariables(refined);
  const preservesIntermediateVars = originalVars.every((v) => refinedVars.includes(v));

  // Req 5.5: readabilityNotReduced — line count doesn't increase dramatically, nesting doesn't increase
  const originalLines = original.split('\n').length;
  const refinedLines = refined.split('\n').length;
  const originalNesting = countMaxNesting(original);
  const refinedNesting = countMaxNesting(refined);
  const lineCountOk = refinedLines <= originalLines * 1.5;
  const nestingOk = refinedNesting <= originalNesting;
  const readabilityNotReduced = lineCountOk && nestingOk;

  return {
    preservesAbstractions,
    noUnrelatedCombining,
    noComplexFunctionalChains,
    preservesIntermediateVars,
    readabilityNotReduced,
  };
}

/** Convert a failed BalanceCheck into a human-readable reason. */
function balanceCheckReason(check: BalanceCheck): string {
  const reasons: string[] = [];
  if (!check.preservesAbstractions) reasons.push('reduces number of abstractions (Req 5.1)');
  if (!check.noUnrelatedCombining) reasons.push('combines unrelated operations (Req 5.2)');
  if (!check.noComplexFunctionalChains) reasons.push('introduces complex functional chains (Req 5.3)');
  if (!check.preservesIntermediateVars) reasons.push('inlines named intermediate variables (Req 5.4)');
  if (!check.readabilityNotReduced) reasons.push('reduces readability (Req 5.5)');
  return `Balance check failed: ${reasons.join('; ')}`;
}

// ---------------------------------------------------------------------------
// Public implementation
// ---------------------------------------------------------------------------

export class DefaultBehaviorPreservationValidator implements BehaviorPreservationValidator {
  validate(transformation: Transformation, _context: CodeSection): ValidationResult {
    const { original, refined } = transformation;

    // If original and refined are identical, it's trivially safe
    if (original === refined) {
      return { safe: true };
    }

    // 1. Check public API signatures unchanged (Req 1.2)
    const sigResult = checkSignaturesPreserved(original, refined);
    if (!sigResult.safe) return sigResult;

    // 2. Check error handling paths preserved (Req 1.3)
    const errResult = checkErrorHandlingPreserved(original, refined);
    if (!errResult.safe) return errResult;

    // 3. Check side-effect execution order maintained (Req 1.4)
    const sideEffectResult = checkSideEffectOrder(original, refined);
    if (!sideEffectResult.safe) return sideEffectResult;

    // 4. Check no removal of reachable code paths (Req 1.1)
    const codePathResult = checkNoCodePathRemoval(original, refined);
    if (!codePathResult.safe) return codePathResult;

    // 5. Run balance checks (Req 5.1–5.5)
    const balanceCheck = evaluateBalanceChecks(original, refined);
    const allBalancePass =
      balanceCheck.preservesAbstractions &&
      balanceCheck.noUnrelatedCombining &&
      balanceCheck.noComplexFunctionalChains &&
      balanceCheck.preservesIntermediateVars &&
      balanceCheck.readabilityNotReduced;

    if (!allBalancePass) {
      return { safe: false, reason: balanceCheckReason(balanceCheck) };
    }

    return { safe: true };
  }
}

// Export helpers for testing
export {
  extractFunctionSignatures,
  extractErrorHandlingPatterns,
  extractSideEffects,
  countFunctions,
  extractIntermediateVariables,
  countMaxNesting,
  hasComplexFunctionalChains,
  evaluateBalanceChecks,
};
