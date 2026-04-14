const BLOCKED_IDENTIFIERS = new Set([
  "system",
  "with_stdout",
  "with_stderr",
  "open_input",
  "open_output",
  "close",
  "readfile",
  "writefile",
  "appendfile",
  "load",
  "batchload",
  "kill",
  "quit",
  "to_lisp",
  "lisp",
]);

const ALLOWED_CHAR_PATTERN = /^[a-zA-Z0-9_%+\-*/^().,<>!=&|\s]*$/;
const FORBIDDEN_SEQUENCE_PATTERN = /(;|\$|:lisp|\/\*|\*\/|\/\/|[\[\]{}'"`\\])/i;
const IDENTIFIER_PATTERN = /%?[a-zA-Z_][a-zA-Z0-9_]*/g;

const MAX_EXPRESSION_LENGTH = 500;

function hasBalancedParentheses(input: string): boolean {
  let depth = 0;
  for (const ch of input) {
    if (ch === "(") depth += 1;
    if (ch === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

function hasBlockedIdentifier(input: string): string | null {
  const matches = input.match(IDENTIFIER_PATTERN) ?? [];
  for (const raw of matches) {
    const id = raw.startsWith("%")
      ? raw.slice(1).toLowerCase()
      : raw.toLowerCase();
    if (BLOCKED_IDENTIFIERS.has(id)) return raw;
  }
  return null;
}

export function sanitizeExpression(expr: string): {
  valid: boolean;
  error?: string;
} {
  if (!expr || typeof expr !== "string") {
    return { valid: false, error: "Expression must be a non-empty string" };
  }

  if (expr.length > MAX_EXPRESSION_LENGTH) {
    return {
      valid: false,
      error: `Expression exceeds maximum length of ${MAX_EXPRESSION_LENGTH} characters`,
    };
  }

  if (!ALLOWED_CHAR_PATTERN.test(expr)) {
    return {
      valid: false,
      error: "Expression contains invalid characters",
    };
  }

  if (FORBIDDEN_SEQUENCE_PATTERN.test(expr)) {
    return {
      valid: false,
      error: "Expression contains forbidden control sequences",
    };
  }

  if (!hasBalancedParentheses(expr)) {
    return {
      valid: false,
      error: "Expression has unbalanced parentheses",
    };
  }

  const blocked = hasBlockedIdentifier(expr);
  if (blocked) {
    return {
      valid: false,
      error: `Expression contains forbidden identifier: ${blocked}`,
    };
  }

  return { valid: true };
}

export function sanitizeVariableName(
  name: string,
  label = "variable",
): { valid: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { valid: false, error: `${label} must be a non-empty string` };
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    return { valid: false, error: `${label} must be a valid variable name` };
  }

  if (BLOCKED_IDENTIFIERS.has(name.toLowerCase())) {
    return { valid: false, error: `${label} is not allowed` };
  }

  return { valid: true };
}

export function sanitizeSegments(
  segments: Array<{ expression: string; from: string; to: string }>,
): { valid: boolean; error?: string } {
  for (const segment of segments) {
    const exprCheck = sanitizeExpression(segment.expression);
    if (!exprCheck.valid) {
      return {
        valid: false,
        error: `Invalid expression "${segment.expression}": ${exprCheck.error}`,
      };
    }

    const fromCheck = sanitizeExpression(segment.from);
    if (!fromCheck.valid) {
      return {
        valid: false,
        error: `Invalid from "${segment.from}": ${fromCheck.error}`,
      };
    }

    const toCheck = sanitizeExpression(segment.to);
    if (!toCheck.valid) {
      return {
        valid: false,
        error: `Invalid to "${segment.to}": ${toCheck.error}`,
      };
    }
  }

  return { valid: true };
}
