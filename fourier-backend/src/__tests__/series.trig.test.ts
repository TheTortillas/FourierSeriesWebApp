import { describe, it, expect, beforeAll } from "vitest";
import { MaximaRunner } from "../infrastructure/maxima/maximaRunner";
import { MaximaPostProcessor } from "../infrastructure/postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";
import { TrigonometricService } from "../application/fourier/trigonometric.service";
import { isEquivSeries } from "./helpers/equivSeries";
import allCases from "./fixtures/series.json";

const cases = allCases.filter((c) => c.type === "trig");

let service: TrigonometricService;

beforeAll(() => {
  const runner = new MaximaRunner();
  const pp = new MaximaPostProcessor(runner);
  const aux = new AuxiliaryService(runner);
  service = new TrigonometricService(runner, pp, aux);
});

describe("Trigonometric Fourier Series", () => {
  for (const tc of cases) {
    it(`[${tc.id}] ${tc.description}`, async () => {
      const result = await service.calculate({
        segments: tc.input.segments,
        intVar: tc.input.intVar,
        seriesType: "trigonometric",
      });

      const exp = tc.expected as {
        a0?: string;
        an?: string;
        bn?: string;
        w0?: string;
      };

      // ── w0 (fundamental frequency) ─────────────────────────────────────
      if (exp.w0) {
        expect(result.w0.maxima, `w0 mismatch`).toBe(exp.w0);
      }

      // ── a0 ────────────────────────────────────────────────────────────
      if (exp.a0 !== undefined) {
        expect(
          result.coefficients.a0?.maxima,
          `a0 should be defined`,
        ).toBeDefined();
        const equiv = await isEquivSeries(
          result.coefficients.a0!.maxima,
          exp.a0,
        );
        expect(
          equiv,
          `[${tc.id}] a0 not equivalent.\n  got:      ${result.coefficients.a0!.maxima}\n  expected: ${exp.a0}`,
        ).toBe(true);
      }

      // ── an ────────────────────────────────────────────────────────────
      if (exp.an !== undefined) {
        expect(
          result.coefficients.an?.maxima,
          `an should be defined`,
        ).toBeDefined();
        const equiv = await isEquivSeries(
          result.coefficients.an!.maxima,
          exp.an,
        );
        expect(
          equiv,
          `[${tc.id}] an not equivalent.\n  got:      ${result.coefficients.an!.maxima}\n  expected: ${exp.an}`,
        ).toBe(true);
      }

      // ── bn ────────────────────────────────────────────────────────────
      if (exp.bn !== undefined) {
        expect(
          result.coefficients.bn?.maxima,
          `bn should be defined`,
        ).toBeDefined();
        const equiv = await isEquivSeries(
          result.coefficients.bn!.maxima,
          exp.bn,
        );
        expect(
          equiv,
          `[${tc.id}] bn not equivalent.\n  got:      ${result.coefficients.bn!.maxima}\n  expected: ${exp.bn}`,
        ).toBe(true);
      }
    });
  }
});
