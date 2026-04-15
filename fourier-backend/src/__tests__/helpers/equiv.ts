import { MaximaRunner } from '../../infrastructure/maxima/maximaRunner';

const runner = new MaximaRunner();

/**
 * Verifies symbolic equivalence of two Maxima expressions using ratsimp.
 * For expressions involving delta distributions, ratsimp treats delta as
 * a symbol and can still verify algebraic equivalence.
 *
 * Returns true if ratsimp(actual - expected) = 0.
 * Falls back to false (not throws) if Maxima times out or errors.
 */
export async function isEquivalent(
  actual: string,
  expected: string,
  params: string[] = [],
): Promise<boolean> {
  // Declare symbolic params as positive reals so Maxima can simplify correctly
  const assumptions = params
    .map((p) => `assume(${p} > 0)$`)
    .join('\n');

  const script = `
${assumptions}
_actual: ${actual}$
_expected: ${expected}$
_diff: ratsimp(_actual - _expected)$
if _diff = 0
  then print("__EQUIV__: true")
  else print("__EQUIV__: false")$
kill(all)$
`;

  const result = await runner.run({ script, timeoutMs: 20_000 });
  return result.success && result.raw.includes('__EQUIV__: true');
}
