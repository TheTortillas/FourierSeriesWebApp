import { inject, Injectable } from '@angular/core';
import { CanvasViewport, Curve, MathPoint, CanvasRenderConfig, DEFAULT_RENDER_CONFIG } from './canvas.types';
import { CoordinateTransformService } from './coordinate-transform.service';

/**
 * Samples mathematical functions and renders them onto a canvas context.
 *
 * Responsibilities:
 * - Adaptive sampling based on canvas CSS width (not a fixed count)
 * - Discontinuity detection: breaks the path at NaN, Infinity, or large jumps
 * - Clipping guard: only draws within the visible canvas rect + margin
 * - Rendering pre-sampled Curve objects
 *
 * All rendering is done in CSS pixel space (ctx has dpr scale applied).
 */
@Injectable({ providedIn: 'root' })
export class PlottingService {
  private readonly t = inject(CoordinateTransformService);

  // ── Sampling ──────────────────────────────────────────────────────────────

  /**
   * Samples a function over the full visible X range.
   *
   * Step count = `cssWidth × effectiveOversample` where `effectiveOversample`
   * is at least `config.defaultOversample` and grows on wide canvases so that
   * high-frequency functions stay smooth regardless of viewport width.
   *
   * @param oversample  Explicit override. When omitted, computed adaptively from config.
   * @param config      Render tunables. Defaults to DEFAULT_RENDER_CONFIG.
   */
  sampleVisible(
    fn: (x: number) => number,
    vp: CanvasViewport,
    oversample?: number,
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): MathPoint[] {
    const effective = oversample ?? Math.max(config.defaultOversample, Math.ceil(vp.cssWidth / 200));
    const range = this.t.visibleRange(vp);
    return this.sampleRange(fn, range.xMin, range.xMax, vp.cssWidth * effective);
  }

  /**
   * Samples a function over [xFrom, xTo] with `steps` uniform steps.
   *
   * @param openEnds  When true, appends a NaN sentinel as the last point.
   *   This forces `drawCurve` to lift the pen after the last sample, so that
   *   adjacent piecewise pieces never get visually connected — even when they
   *   share the same boundary x-coordinate. Default: false.
   */
  sampleRange(
    fn: (x: number) => number,
    xFrom: number,
    xTo: number,
    steps: number,
    openEnds = false,
  ): MathPoint[] {
    const pts: MathPoint[] = [];
    const n = Math.max(2, Math.round(steps));
    for (let i = 0; i <= n; i++) {
      const x = xFrom + (i / n) * (xTo - xFrom);
      try {
        const y = fn(x);
        pts.push({ x, y: isFinite(y) ? y : NaN });
      } catch {
        pts.push({ x, y: NaN });
      }
    }
    // Sentinel: lift the pen so the next piece starts independently
    if (openEnds) pts.push({ x: xTo, y: NaN });
    return pts;
  }

  /**
   * Samples a piecewise function defined by an array of { fn, from, to }.
   *
   * Each piece is sampled independently and separated by a NaN sentinel so
   * `drawCurve` never connects adjacent pieces — eliminating the spurious
   * vertical line that appears when two pieces share a boundary x-value but
   * have different y-values there.
   *
   * Steps per piece scale with the viewport width (adaptive, same logic as
   * `sampleVisible`) so the density is always proportional to screen space.
   */
  samplePiecewise(
    pieces: { fn: (x: number) => number; from: number; to: number }[],
    vp: CanvasViewport,
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): MathPoint[] {
    const oversample = Math.max(config.defaultOversample, Math.ceil(vp.cssWidth / 200));
    const range = this.t.visibleRange(vp);
    const visibleWidth = Math.max(1, range.xMax - range.xMin);
    const stepsPerUnit = (vp.cssWidth * oversample) / visibleWidth;

    return pieces.flatMap(({ fn, from, to }) => {
      // Steps proportional to the piece width relative to the visible range —
      // wide pieces get more samples, narrow ones fewer, minimum 4.
      const steps = Math.max(4, Math.round(stepsPerUnit * (to - from)));
      return this.sampleRange(fn, from, to, steps, /* openEnds */ true);
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Draws a pre-sampled Curve onto ctx.
   * Automatically breaks the path at NaN values and large Y jumps
   * (discontinuity detection).
   *
   * @param config  Render tunables. Defaults to DEFAULT_RENDER_CONFIG.
   */
  drawCurve(
    ctx: CanvasRenderingContext2D,
    curve: Curve,
    vp: CanvasViewport,
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): void {
    if (curve.points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = curve.color;
    ctx.lineWidth   = curve.lineWidth;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';

    if (curve.dashed) {
      ctx.setLineDash([6, 4]);
    }

    ctx.beginPath();
    let penDown = false;
    let prevSy  = NaN;

    for (const pt of curve.points) {
      if (!isFinite(pt.y) || isNaN(pt.y)) {
        penDown = false;
        prevSy  = NaN;
        continue;
      }

      const sx = this.t.mathToScreenX(pt.x, vp) / vp.dpr;
      const sy = this.t.mathToScreenY(pt.y, vp) / vp.dpr;

      // Discontinuity: large vertical jump
      if (penDown && isFinite(prevSy) && Math.abs(sy - prevSy) > config.maxJumpPx) {
        penDown = false;
      }

      if (!penDown) {
        ctx.moveTo(sx, sy);
        penDown = true;
      } else {
        ctx.lineTo(sx, sy);
      }
      prevSy = sy;
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Convenience: sample and draw a function over the visible range in one call.
   *
   * @param config  Render tunables passed to both sampleVisible and drawCurve.
   */
  plotFn(
    ctx: CanvasRenderingContext2D,
    fn: (x: number) => number,
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean },
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): void {
    const points = this.sampleVisible(fn, vp, undefined, config);
    this.drawCurve(ctx, { points, ...style }, vp, config);
  }

  /**
   * Convenience: sample and draw a function over [from, to] in one call.
   *
   * @param config  Render tunables passed to drawCurve.
   */
  plotFnRange(
    ctx: CanvasRenderingContext2D,
    fn: (x: number) => number,
    from: number,
    to: number,
    steps: number,
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean },
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): void {
    const points = this.sampleRange(fn, from, to, steps);
    this.drawCurve(ctx, { points, ...style }, vp, config);
  }

  /**
   * Samples and draws a piecewise-defined function in a single canvas path.
   *
   * Each piece is isolated by a NaN sentinel so no spurious vertical line
   * is drawn at the shared boundary between adjacent pieces — regardless of
   * how large or small the jump between them is. This fixes the intermittent
   * "ghost vertical line" seen when zooming or changing parameters on
   * functions like sinc(a·t) with small values of a.
   *
   * Pieces with non-finite bounds (±Infinity) are silently skipped; callers
   * should handle infinite-domain pieces with a gated `plotFn` instead.
   *
   * @param pieces  Array of `{ fn, from, to }` — each piece sampled over [from, to].
   * @param vp      Current viewport (used for adaptive step count).
   * @param style   Stroke color, lineWidth, optional dashed flag.
   * @param config  Render tunables. Defaults to DEFAULT_RENDER_CONFIG.
   */
  plotPiecewise(
    ctx: CanvasRenderingContext2D,
    pieces: { fn: (x: number) => number; from: number; to: number }[],
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean },
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): void {
    const finite = pieces.filter(p => isFinite(p.from) && isFinite(p.to));
    if (finite.length === 0) return;
    const points = this.samplePiecewise(finite, vp, config);
    this.drawCurve(ctx, { points, ...style }, vp, config);
  }

  // ── Spectrum bars ─────────────────────────────────────────────────────────

  /**
   * Draws a discrete amplitude/phase spectrum as vertical bars.
   * Each bar is drawn from y=0 to y=amplitude at x=n.
   */
  drawSpectrum(
    ctx: CanvasRenderingContext2D,
    values: { n: number; value: number }[],
    vp: CanvasViewport,
    style: { color: string; barWidth?: number },
  ): void {
    const barW = style.barWidth ?? Math.max(2, vp.unit * 0.15);

    ctx.save();
    ctx.fillStyle = style.color;

    const y0 = this.t.mathToScreenY(0, vp) / vp.dpr;

    for (const { n, value } of values) {
      if (!isFinite(value)) continue;
      const sx = this.t.mathToScreenX(n, vp) / vp.dpr;
      const sy = this.t.mathToScreenY(value, vp) / vp.dpr;
      ctx.fillRect(sx - barW / 2, Math.min(sy, y0), barW, Math.abs(y0 - sy));
    }

    ctx.restore();
  }
}
