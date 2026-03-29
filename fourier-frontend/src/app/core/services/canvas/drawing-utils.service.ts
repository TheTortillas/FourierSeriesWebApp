import { inject, Injectable } from '@angular/core';
import { CanvasViewport } from './canvas.types';
import { CoordinateTransformService } from './coordinate-transform.service';

const TAU = Math.PI * 2;

/**
 * Discrete / geometric canvas drawing primitives.
 *
 * Coordinate conventions
 * ──────────────────────
 * • Methods that take *math* coordinates (mathX, mathY, points[]) convert
 *   them to CSS pixel space internally via CoordinateTransformService
 *   (dividing by vp.dpr). This matches the pre-scaled context provided by
 *   FunctionPlotComponent: `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
 *
 * • Methods that take *pixel* coordinates (drawLine, drawArrowHead) expect
 *   CSS pixels — the caller has already converted (mathToScreen / vp.dpr).
 *   This keeps the epicycle overlay code readable: convert once, draw many.
 *
 * Color helpers
 * ─────────────
 * `withAlpha` works with HSL strings produced by `harmonicColor`-style
 * generators. For a generalised RGBA solution, pass an rgba() string
 * directly to the drawing methods instead.
 */
@Injectable({ providedIn: 'root' })
export class DrawingUtilsService {
  private readonly coords = inject(CoordinateTransformService);

  // ── Stems ─────────────────────────────────────────────────────────────────

  /**
   * Draws a vertical stem from the x-axis (y = 0) to the point (mathX, mathY).
   *
   * @param markerRadius  Radius of the filled circle drawn at the tip.
   *                      Pass 0 (default) to omit the marker.
   */
  drawStem(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    mathX: number,
    mathY: number,
    color: string,
    lineWidth: number,
    markerRadius = 0,
  ): void {
    const x  = this.coords.mathToScreenX(mathX, vp) / vp.dpr;
    const y0 = this.coords.mathToScreenY(0,     vp) / vp.dpr;
    const y1 = this.coords.mathToScreenY(mathY, vp) / vp.dpr;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = lineWidth;

    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();

    if (markerRadius > 0) {
      ctx.beginPath();
      ctx.arc(x, y1, markerRadius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Point clouds ──────────────────────────────────────────────────────────

  /**
   * Draws a filled circle at each point (math-space coordinates).
   */
  drawPoints(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    points: { x: number; y: number }[],
    color: string,
    radius: number,
  ): void {
    if (points.length === 0) return;

    ctx.save();
    ctx.fillStyle = color;

    for (const p of points) {
      const sx = this.coords.mathToScreenX(p.x, vp) / vp.dpr;
      const sy = this.coords.mathToScreenY(p.y, vp) / vp.dpr;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Lines & arrows ────────────────────────────────────────────────────────

  /**
   * Draws a straight line segment between two points in CSS pixel space.
   *
   * Used for epicycle vectors and other geometric connectors where the
   * caller has already converted math coordinates to CSS pixels.
   */
  drawLine(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    strokeStyle: string,
    lineWidth: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth   = lineWidth;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draws a filled arrowhead pointing from (fromX, fromY) toward (toX, toY).
   * Coordinates are in CSS pixels (pre-converted by the caller).
   *
   * @param headLength  Length of the arrowhead wings in CSS pixels (default 6).
   * @param spread      Half-angle of the arrowhead opening in radians (default π/7).
   */
  drawArrowHead(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fillStyle: string,
    headLength = 6,
    spread = Math.PI / 7,
  ): void {
    const dx  = toX - fromX;
    const dy  = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 2.5) return;

    const angle = Math.atan2(dy, dx);
    const x1 = toX - headLength * Math.cos(angle - spread);
    const y1 = toY - headLength * Math.sin(angle - spread);
    const x2 = toX - headLength * Math.cos(angle + spread);
    const y2 = toY - headLength * Math.sin(angle + spread);

    ctx.beginPath();
    ctx.fillStyle = fillStyle;
    ctx.moveTo(toX, toY);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  }

  // ── Circles ───────────────────────────────────────────────────────────────

  /**
   * Draws a circle at a CSS pixel position.
   *
   * @param strokeStyle  Outline color. Pass `null` to skip stroke.
   * @param lineWidth    Stroke width (default 1). Ignored when strokeStyle is null.
   * @param fillStyle    Fill color. Pass `null` (default) to skip fill.
   */
  drawCircle(
    ctx: CanvasRenderingContext2D,
    cssX: number,
    cssY: number,
    radius: number,
    strokeStyle: string | null,
    lineWidth = 1,
    fillStyle: string | null = null,
  ): void {
    if (radius <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cssX, cssY, radius, 0, TAU);

    if (fillStyle !== null) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (strokeStyle !== null) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth   = lineWidth;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Color utilities ───────────────────────────────────────────────────────

  /**
   * Applies an alpha value to an HSL color string of the form `hsl(H S% L%)`.
   *
   * Returns `hsl(H S% L% / alpha)` — the standard CSS color-level-4 syntax
   * that modern browsers support natively.
   *
   * Non-HSL strings are returned unchanged so callers can safely pass any
   * color without branching.
   *
   * @param color  An `hsl(...)` color string (as produced by harmonicColor).
   * @param alpha  Opacity in [0, 1]. Clamped automatically.
   */
  withAlpha(color: string, alpha: number): string {
    const clamped = Math.max(0, Math.min(1, alpha));
    if (!color.startsWith('hsl(')) return color;
    return color.replace(/^hsl\((.*)\)$/u, `hsl($1 / ${clamped.toFixed(3)})`);
  }
}
