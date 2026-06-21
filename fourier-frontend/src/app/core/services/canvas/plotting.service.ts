import { inject, Injectable } from '@angular/core';
import { CanvasViewport, Curve, Discontinuity, MathPoint, CanvasRenderConfig, DEFAULT_RENDER_CONFIG } from './canvas.types';
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
   *
   * Also returns the auto-detected discontinuities at shared boundaries where
   * the left-limit y (last sample of piece i) differs from the right-limit y
   * (first sample of piece i+1). Used by `plotPiecewise` to render jump markers.
   */
  samplePiecewise(
    pieces: { fn: (x: number) => number; from: number; to: number }[],
    vp: CanvasViewport,
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): { points: MathPoint[]; discontinuities: Discontinuity[] } {
    const oversample = Math.max(config.defaultOversample, Math.ceil(vp.cssWidth / 200));
    const range = this.t.visibleRange(vp);
    const visibleWidth = Math.max(1, range.xMax - range.xMin);
    const stepsPerUnit = (vp.cssWidth * oversample) / visibleWidth;

    const allPoints: MathPoint[] = [];
    const discontinuities: Discontinuity[] = [];

    for (let i = 0; i < pieces.length; i++) {
      const { fn, from, to } = pieces[i];
      const steps = Math.max(4, Math.round(stepsPerUnit * (to - from)));
      const pts = this.sampleRange(fn, from, to, steps, /* openEnds */ true);
      allPoints.push(...pts);

      // Detect discontinuity at the shared boundary with the next piece.
      // pts[pts.length - 2] is the last real point (pts.last is the NaN sentinel).
      if (i < pieces.length - 1) {
        const next = pieces[i + 1];
        if (to === next.from) {
          // Evaluate both sides at the boundary.
          let y1: number;
          let y2: number;
          try { y1 = fn(to); } catch { y1 = NaN; }
          try { y2 = next.fn(next.from); } catch { y2 = NaN; }
          if (isFinite(y1) && isFinite(y2)) {
            discontinuities.push({ x: to, y1, y2 });
          }
        }
      }
    }

    return { points: allPoints, discontinuities };
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Draws a pre-sampled Curve onto ctx.
   * Automatically breaks the path at NaN values and large Y jumps
   * (discontinuity detection).
   *
   * If `curve.discontinuities` is provided and `curve.jumpStyle` is `'solid'`
   * or `'dashed'`, a vertical marker line is drawn at each discontinuity after
   * the main path. With `jumpStyle: 'none'` (the default) nothing extra is drawn.
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
      ctx.setLineDash(curve.dashPattern ?? [6, 4]);
    }

    const jumpStyle = curve.jumpStyle ?? 'none';
    const trackHeuristic = jumpStyle !== 'none' && !curve.discontinuities?.length;

    ctx.beginPath();
    let penDown = false;
    let prevSy  = NaN;
    let prevSx  = NaN;
    // Only allocated when jumpStyle is active — avoids per-frame GC on the common path.
    let heuristicJumps: { sx: number; sy1: number; sy2: number }[] | null = null;

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
        if (trackHeuristic) {
          (heuristicJumps ??= []).push({ sx: (sx + prevSx) / 2, sy1: prevSy, sy2: sy });
        }
        penDown = false;
      }

      if (!penDown) {
        ctx.moveTo(sx, sy);
        penDown = true;
      } else {
        ctx.lineTo(sx, sy);
      }
      prevSy = sy;
      prevSx = sx;
    }

    ctx.stroke();

    // ── Jump markers ────────────────────────────────────────────────────────
    const explicitDisc = curve.discontinuities;
    const hasExplicit  = !!explicitDisc?.length;
    const hasHeuristic = !!heuristicJumps?.length;

    if (jumpStyle !== 'none' && (hasExplicit || hasHeuristic)) {
      ctx.lineWidth = Math.max(0.5, curve.lineWidth * 0.5);
      ctx.setLineDash(jumpStyle === 'dashed' ? [4, 4] : []);
      ctx.beginPath();

      if (hasExplicit) {
        for (const { x, y1, y2 } of explicitDisc!) {
          const sx  = this.t.mathToScreenX(x, vp) / vp.dpr;
          const sy1 = this.t.mathToScreenY(y1, vp) / vp.dpr;
          const sy2 = this.t.mathToScreenY(y2, vp) / vp.dpr;
          ctx.moveTo(sx, sy1);
          ctx.lineTo(sx, sy2);
        }
      } else {
        for (const { sx, sy1, sy2 } of heuristicJumps!) {
          ctx.moveTo(sx, sy1);
          ctx.lineTo(sx, sy2);
        }
      }

      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Convenience: sample and draw a function over the visible range in one call.
   *
   * Pass `jumpStyle: 'solid'` or `'dashed'` in `style` to render detected
   * discontinuities as vertical marker lines instead of invisible pen lifts.
   *
   * @param config  Render tunables passed to both sampleVisible and drawCurve.
   */
  plotFn(
    ctx: CanvasRenderingContext2D,
    fn: (x: number) => number,
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean; dashPattern?: number[]; jumpStyle?: 'none' | 'solid' | 'dashed' },
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
    style: { color: string; lineWidth: number; dashed?: boolean; dashPattern?: number[]; jumpStyle?: 'none' | 'solid' | 'dashed' },
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
   * how large or small the jump between them is.
   *
   * Discontinuities at shared boundaries are auto-detected and rendered
   * according to `style.jumpStyle`:
   * - `'none'`   (default) — pen lifted, nothing drawn at the jump.
   * - `'solid'`  — solid vertical line from y₁ to y₂ at each boundary jump.
   * - `'dashed'` — dashed vertical line at each boundary jump.
   *
   * Pieces with non-finite bounds (±Infinity) are silently skipped; callers
   * should handle infinite-domain pieces with a gated `plotFn` instead.
   *
   * @param pieces  Array of `{ fn, from, to }` — each piece sampled over [from, to].
   * @param vp      Current viewport (used for adaptive step count).
   * @param style   Stroke style plus optional `jumpStyle` for discontinuity rendering.
   * @param config  Render tunables. Defaults to DEFAULT_RENDER_CONFIG.
   */
  plotPiecewise(
    ctx: CanvasRenderingContext2D,
    pieces: { fn: (x: number) => number; from: number; to: number }[],
    vp: CanvasViewport,
    style: { color: string; lineWidth: number; dashed?: boolean; dashPattern?: number[]; jumpStyle?: 'none' | 'solid' | 'dashed' },
    config: CanvasRenderConfig = DEFAULT_RENDER_CONFIG,
  ): void {
    const finite = pieces.filter(p => isFinite(p.from) && isFinite(p.to));
    if (finite.length === 0) return;
    const { points, discontinuities } = this.samplePiecewise(finite, vp, config);
    this.drawCurve(ctx, { points, ...style, discontinuities }, vp, config);
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
