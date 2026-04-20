import { describe, it, it as itSkip, expect, beforeAll } from 'vitest';
import { MaximaRunner } from '../infrastructure/maxima/maximaRunner';
import { FourierTransformService } from '../application/transforms/fourierTransform.service';
import { isEquivalent } from './helpers/equiv';
import allCases from './fixtures/transforms.json';

const KNOWN_FAILURES = new Set<string>();

const ftCases = allCases.filter((c) => c.type === 'ft');

let service: FourierTransformService;

beforeAll(() => {
  const runner = new MaximaRunner();
  service = new FourierTransformService(runner);
});

describe('Fourier Transform (FT)', () => {
  for (const tc of ftCases) {
    const testFn = KNOWN_FAILURES.has(tc.id) ? itSkip.skip : it;

    testFn(`[${tc.id}] ${tc.description}`, async () => {
      const result = await service.transform({
        segments: tc.input.segments,
        intVar: tc.input.intVar,
        transVar: tc.input.transVar,
      });

      // ── 1. Existence check ────────────────────────────────────────────
      expect(result.exists, `exists mismatch`).toBe(tc.expected.exists);

      if (!tc.expected.exists) return;

      // ── 2. F equivalence (if expected value provided) ─────────────────
      if ('F' in tc.expected && tc.expected.F) {
        expect(result.F, `F should be defined`).toBeDefined();

        const equiv = await isEquivalent(
          result.F!.maxima,
          tc.expected.F,
          (tc.expected as { params?: string[] }).params ?? [],
        );

        expect(
          equiv,
          `[${tc.id}] F not equivalent.\n  got:      ${result.F!.maxima}\n  expected: ${tc.expected.F}`,
        ).toBe(true);
      }

      // ── 3. Params check (if expected params provided) ──────────────────
      const expectedParams = (tc.expected as { params?: string[] }).params;
      if (expectedParams) {
        expect(result.params ?? []).toEqual(
          expect.arrayContaining(expectedParams),
        );
      }
    });
  }
});
