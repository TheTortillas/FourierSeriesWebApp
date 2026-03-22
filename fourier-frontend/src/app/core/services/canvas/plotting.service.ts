import { inject, Injectable } from '@angular/core';
import { CanvasViewport, Curve, MathPoint } from './canvas.types';
import { CoordinateTransformService } from './coordinate-transform.service';

/** Maximum Y-jump (in CSS pixels) before a path is broken at a discontinuity */
const MAX_JUMP_PX = 120;

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
   * Resolution = cssWidth × oversample (default 2× for smoother curves).
   */
  sampleVisible(
    fn: (x: number) => number,
    vp: CanvasViewport,
    oversample = 2,
  ): MathPoint[] {
    const range = this.t.visibleRange(vp);
    return this.sampleRange(fn, range.xMin, range.xMax, vp.cssWidth * oversample);
  }

  /**
   * Samples a function over [xFrom, xTo] with `steps` uniform steps.
   * Falls back to cssWidth×2 steps if not specified.
   */
  sampleRange(
    fn: (x: number) => number,
    xFrom: number,
    xTo: number,
    steps: number,
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
    return pts;
  }

  /**
   * Samples a piecewise function defined by an array of { fn, from, to }.
   * Each piece is sampled independently so endpoints are exact.
   */
  samplePiecewise(
    pieces: { fn: (x: number) => number; from: number; to: number }[],
    stepsPerPiece: number,
  ): MathPoint[] {
    return pieces.flatMap(({ fn, from, to }) =>
      this.sampleRange(fn, from, to, stepsPerPiece),
    );
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Draws a pre-sampled Curve onto ctx.
   * Automatically breaks the path at NaN values and large Y jumps
   * (discontinuity detection).
   */
  drawCurve(
    ctx: CanvasRenderingContext2D,
    curve: Curve,
    vp: CanvasViewport,
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
      if (penDown && isFinite(prevSy) && Math.abs(sy - prevSy) > MAX_JUMP_PX) {
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
   */
  plotFn(
    ctx: CanvasRenderingContext2D,
    fn: (x: number) => number,
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean },
  ): void {
    const points = this.sampleVisible(fn, vp);
    this.drawCurve(ctx, { points, ...style }, vp);
  }

  /**
   * Convenience: sample and draw a function over [from, to] in one call.
   */
  plotFnRange(
    ctx: CanvasRenderingContext2D,
    fn: (x: number) => number,
    from: number,
    to: number,
    steps: number,
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean },
  ): void {
    const points = this.sampleRange(fn, from, to, steps);
    this.drawCurve(ctx, { points, ...style }, vp);
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
