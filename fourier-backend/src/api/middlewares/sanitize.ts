const FORBIDDEN_PATTERNS = [
  /\bsystem\s*\(/i,
  /\bwith_stdout\s*\(/i,
  /\bwith_stderr\s*\(/i,
  /\bopen_input\s*\(/i,
  /\bopen_output\s*\(/i,
  /\bclose\s*\(/i,
  /\breadfile\s*\(/i,
  /\bwritefile\s*\(/i,
  /\bappendfile\s*\(/i,
  /\bload\s*\(/i,
  /\bbatchload\s*\(/i,
  /\bkill\s*\(/i,
  /\bquit\s*\(/i,
  /\:lisp\b/i,
  /\bto_lisp\s*\(/i,
];

const MAX_EXPRESSION_LENGTH = 500;

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

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(expr)) {
      return {
        valid: false,
        error: `Expression contains forbidden pattern: ${pattern.source}`,
      };
    }
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
