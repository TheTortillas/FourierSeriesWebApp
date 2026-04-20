import { describe, it, it as itSkip, expect, beforeAll } from 'vitest';
import { MaximaRunner } from '../infrastructure/maxima/maximaRunner';
import { FourierTransformService } from '../application/transforms/fourierTransform.service';
import { isEquivalent } from './helpers/equiv';
import allCases from './fixtures/transforms.json';

const KNOWN_FAILURES = new Set<string>();

const iftCases = allCases.filter((c) => c.type === 'ift');

let service: FourierTransformService;

beforeAll(() => {
  const runner = new MaximaRunner();
  service = new FourierTransformService(runner);
});

describe('Inverse Fourier Transform (IFT)', () => {
  for (const tc of iftCases) {
    const testFn = KNOWN_FAILURES.has(tc.id) ? itSkip.skip : it;

    testFn(`[${tc.id}] ${tc.description}`, async () => {
      const result = await service.inverseTransform({
        segments: tc.input.segments,
        intVar: tc.input.intVar,
        transVar: tc.input.transVar,
      });

      // ── 1. Existence check ────────────────────────────────────────────
      expect(result.exists, `exists mismatch`).toBe(tc.expected.exists);

      if (!tc.expected.exists) return;

      // ── 2. fCombined equivalence (if expected value provided) ─────────
      if ('fCombined' in tc.expected && tc.expected.fCombined) {
        // Prefer fCombined; fall back to fPositive for piecewise results
        const actualExpr = result.fCombined?.maxima ?? result.fPositive?.maxima;

        expect(actualExpr, `fCombined should be defined`).toBeDefined();

        const equiv = await isEquivalent(
          actualExpr!,
          tc.expected.fCombined,
          (tc.expected as { params?: string[] }).params ?? [],
        );

        expect(
          equiv,
          `[${tc.id}] fCombined not equivalent.\n  got:      ${actualExpr}\n  expected: ${tc.expected.fCombined}`,
        ).toBe(true);
      }

      // ── 3. Params check ───────────────────────────────────────────────
      const expectedParams = (tc.expected as { params?: string[] }).params;
      if (expectedParams) {
        expect(result.params ?? []).toEqual(
          expect.arrayContaining(expectedParams),
        );
      }
    });
  }
});
