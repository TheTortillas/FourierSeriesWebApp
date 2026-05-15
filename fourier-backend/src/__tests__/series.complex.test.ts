import { describe, it, expect, beforeAll } from "vitest";
import { MaximaRunner } from "../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";
import { ComplexService } from "../application/fourier/complex.service";
import { isEquivSeries } from "./helpers/equivSeries";
import allCases from "./fixtures/series.json";

const cases = allCases.filter((c) => c.type === "complex");

let service: ComplexService;

beforeAll(() => {
  const runner = new MaximaRunner();
  const pp = new MaximaPostProcessor(runner);
  const aux = new AuxiliaryService(runner);
  service = new ComplexService(runner, pp, aux);
});

describe("Complex Fourier Series", () => {
  for (const tc of cases) {
    it(`[${tc.id}] ${tc.description}`, async () => {
      const result = await service.calculate({
        segments: tc.input.segments,
        intVar: tc.input.intVar,
        seriesType: "complex",
      });

      const exp = tc.expected as {
        c0?: string;
        cn?: string;
        w0?: string;
      };

      // ── w0 ───────────────────────────────────────────────────────────
      if (exp.w0) {
        expect(result.w0.maxima, `w0 mismatch`).toBe(exp.w0);
      }

      // ── c0 ────────────────────────────────────────────────────────────
      if (exp.c0 !== undefined) {
        expect(
          result.coefficients.c0?.maxima,
          `c0 should be defined`,
        ).toBeDefined();
        const equiv = await isEquivSeries(
          result.coefficients.c0!.maxima,
          exp.c0,
        );
        expect(
          equiv,
          `[${tc.id}] c0 not equivalent.\n  got:      ${result.coefficients.c0!.maxima}\n  expected: ${exp.c0}`,
        ).toBe(true);
      }

      // ── cn ────────────────────────────────────────────────────────────
      if (exp.cn !== undefined) {
        expect(
          result.coefficients.cn?.maxima,
          `cn should be defined`,
        ).toBeDefined();
        const equiv = await isEquivSeries(
          result.coefficients.cn!.maxima,
          exp.cn,
        );
        expect(
          equiv,
          `[${tc.id}] cn not equivalent.\n  got:      ${result.coefficients.cn!.maxima}\n  expected: ${exp.cn}`,
        ).toBe(true);
      }
    });
  }
});
