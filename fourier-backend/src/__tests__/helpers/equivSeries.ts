import { MaximaRunner } from '../../infrastructure/maxima/maximaRunner';

const runner = new MaximaRunner();

/**
 * Verifies symbolic equivalence of two Maxima expressions that may contain n
 * as a summation index (integer ≥ 1).
 *
 * Declares n as a positive integer so Maxima can apply:
 *   sin(%pi*n) = 0,  cos(%pi*n) = (-1)^n,  e^(2*%i*%pi*n) = 1
 *
 * Also applies demoivre() before ratsimp so complex exponential forms
 * (e.g. complex Fourier coefficients) are correctly simplified.
 *
 * Returns true iff ratsimp(demoivre(actual - expected)) = 0.
 */
export async function isEquivSeries(
  actual: string,
  expected: string,
): Promise<boolean> {
  const script = `
declare(n, integer)$
assume(n > 0)$
_actual: ${actual}$
_expected: ${expected}$
_diff: ratsimp(demoivre(_actual - _expected))$
if _diff = 0
  then print("__EQUIV__: true")
  else print("__EQUIV__: false")$
kill(all)$
`;

  const result = await runner.run({ script, timeoutMs: 20_000 });
  return result.success && result.raw.includes('__EQUIV__: true');
}
