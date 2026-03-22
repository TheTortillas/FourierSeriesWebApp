import { inject, Injectable } from '@angular/core';
import { CanvasViewport, CanvasTheme } from './canvas.types';
import { CoordinateTransformService } from './coordinate-transform.service';

const TARGET_GRID_PX = 80;  // target CSS pixels between major grid lines
const MIN_LABEL_GAP  = 44;  // minimum CSS pixels between axis labels

/**
 * Renders the Cartesian plane: background, grid, axes, labels.
 *
 * All coordinates passed to the canvas ctx are in physical (DPR-scaled) pixels.
 * The ctx is expected to already have ctx.scale(dpr, dpr) applied so we can
 * reason in CSS pixels — we use CSS pixels throughout this service.
 */
@Injectable({ providedIn: 'root' })
export class CanvasRendererService {
  private readonly t = inject(CoordinateTransformService);

  /**
   * Full redraw of background + grid + axes + labels.
   * Call this once per frame before plotting any curves.
   */
  drawBackground(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    theme: CanvasTheme,
  ): void {
    ctx.save();

    // 1. Background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, vp.cssWidth, vp.cssHeight);

    // 2. Grid
    this.drawGrid(ctx, vp, theme);

    // 3. Axes
    this.drawAxes(ctx, vp, theme);

    // 4. Labels
    this.drawLabels(ctx, vp, theme);

    ctx.restore();
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    theme: CanvasTheme,
  ): void {
    // X step must match the label step so grid lines align with labels
    const step   = this.xStep(vp);
    const range  = this.t.visibleRange(vp);

    const xStart = Math.floor(range.xMin / step) * step;

    ctx.beginPath();
    const minorPath = new Path2D();
    const majorPath = new Path2D();

    // Vertical lines
    for (let x = xStart; x <= range.xMax + step; x += step) {
      const sx = this.t.mathToScreenX(x, vp) / vp.dpr;
      // "major" every 5th line relative to origin
      const isMajor = Math.abs(Math.round(x / step) % 5) === 0;
      (isMajor ? majorPath : minorPath).moveTo(sx, 0);
      (isMajor ? majorPath : minorPath).lineTo(sx, vp.cssHeight);
    }

    // Horizontal lines (use same step — symmetric grid)
    const stepY   = this.t.niceStep(TARGET_GRID_PX, vp.unit * vp.scaleY);
    const yStartH = Math.floor(range.yMin / stepY) * stepY;

    for (let y = yStartH; y <= range.yMax + stepY; y += stepY) {
      const sy = this.t.mathToScreenY(y, vp) / vp.dpr;
      const isMajor = Math.abs(Math.round(y / stepY) % 5) === 0;
      (isMajor ? majorPath : minorPath).moveTo(0,          sy);
      (isMajor ? majorPath : minorPath).lineTo(vp.cssWidth, sy);
    }

    ctx.strokeStyle = theme.gridMinor;
    ctx.lineWidth   = 0.5;
    ctx.stroke(minorPath);

    ctx.strokeStyle = theme.gridMajor;
    ctx.lineWidth   = 1;
    ctx.stroke(majorPath);
  }

  // ── Axes ──────────────────────────────────────────────────────────────────

  private drawAxes(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    theme: CanvasTheme,
  ): void {
    const ox = this.t.mathToScreenX(0, vp) / vp.dpr;
    const oy = this.t.mathToScreenY(0, vp) / vp.dpr;

    ctx.strokeStyle = theme.axis;
    ctx.lineWidth   = 1.5;
    ctx.lineCap     = 'square';

    ctx.beginPath();
    // X axis
    ctx.moveTo(0,           oy);
    ctx.lineTo(vp.cssWidth, oy);
    // Y axis
    ctx.moveTo(ox, 0);
    ctx.lineTo(ox, vp.cssHeight);
    ctx.stroke();
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    vp: CanvasViewport,
    theme: CanvasTheme,
  ): void {
    const step  = this.xStep(vp);
    const stepY = this.t.niceStep(TARGET_GRID_PX, vp.unit * vp.scaleY);
    const range = this.t.visibleRange(vp);

    const ox = this.t.mathToScreenX(0, vp) / vp.dpr;
    const oy = this.t.mathToScreenY(0, vp) / vp.dpr;

    ctx.fillStyle = theme.label;
    ctx.font      = `${11 * vp.dpr / vp.dpr}px JetBrains Mono, monospace`;
    ctx.textBaseline = 'top';

    // ── X axis labels ──────────────────────────────────────────────────────
    const xStart    = Math.ceil(range.xMin / step) * step;
    let lastLabelX  = -Infinity;

    for (let x = xStart; x <= range.xMax + step * 0.5; x += step) {
      if (Math.abs(x) < step * 0.01) continue; // skip origin
      const sx = this.t.mathToScreenX(x, vp) / vp.dpr;
      if (sx - lastLabelX < MIN_LABEL_GAP) continue;

      const label = this.formatX(x, step, vp);
      ctx.textAlign = 'center';
      const labelY  = Math.min(Math.max(oy + 5, 5), vp.cssHeight - 18);
      ctx.fillText(label, sx, labelY);
      lastLabelX = sx;
    }

    // ── Y axis labels ──────────────────────────────────────────────────────
    const yStart    = Math.ceil(range.yMin / stepY) * stepY;
    let lastLabelY  = Infinity;

    ctx.textAlign    = 'right';
    ctx.textBaseline = 'middle';

    for (let y = yStart; y <= range.yMax + stepY * 0.5; y += stepY) {
      if (Math.abs(y) < stepY * 0.01) continue;
      const sy = this.t.mathToScreenY(y, vp) / vp.dpr;
      if (lastLabelY - sy < MIN_LABEL_GAP) continue;

      const label  = this.formatY(y, stepY);
      const labelX = Math.min(Math.max(ox - 6, 6), vp.cssWidth - 6);
      ctx.fillText(label, labelX, sy);
      lastLabelY = sy;
    }

    // ── Origin label ───────────────────────────────────────────────────────
    const showOx = ox > 10 && ox < vp.cssWidth  - 10;
    const showOy = oy > 10 && oy < vp.cssHeight - 10;
    if (showOx && showOy) {
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', ox - 5, oy + 5);
    }
  }

  // ── Label formatting ──────────────────────────────────────────────────────

  private formatX(x: number, step: number, vp: CanvasViewport): string {
    if (vp.xAxisFormat === 'pi')     return this.formatPi(x, step);
    if (vp.xAxisFormat === 'e')      return this.formatE(x, step);
    if (vp.xAxisFormat === 'custom') return this.formatCustom(x, step, vp.customConst.symbol, vp.customConst.value);
    return this.formatNumber(x, step);
  }

  private formatY(y: number, step: number): string {
    return this.formatNumber(y, step);
  }

  private formatNumber(v: number, step: number): string {
    // Determine decimal places from step magnitude
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    return v.toFixed(decimals);
  }

  private formatPi(x: number, step: number): string {
    return this.formatConst(x, step, Math.PI, 'π');
  }

  private formatE(x: number, step: number): string {
    return this.formatConst(x, step, Math.E, 'e');
  }

  private formatCustom(x: number, step: number, symbol: string, value: number): string {
    return this.formatConst(x, step, value, symbol);
  }

  /**
   * Formats x as a fraction/multiple of `constVal` with `symbol`.
   * Always reduces the fraction (uses GCD) so 4π/4 → π, 6π/3 → 2π.
   */
  private formatConst(x: number, step: number, constVal: number, symbol: string): string {
    // Express step as k/d * constVal (find d from candidate steps)
    const candidates = [1/4, 1/3, 1/2, 1, 2, 5, 10, 20, 50, 100];
    const fracOfConst = candidates.find(f => Math.abs(step - f * constVal) < Math.abs(step) * 0.01) ?? 1;
    // denom and numerator before reduction: x = (n/denom) * constVal
    const denomRaw = Math.round(1 / fracOfConst); // e.g. step=π/2 → denom=2
    const nRaw     = Math.round(x / (fracOfConst * constVal));

    if (nRaw === 0) return '0';

    // Reduce fraction n/denom
    const g    = this.gcd(Math.abs(nRaw), denomRaw);
    const num  = Math.abs(nRaw) / g;
    const den  = denomRaw / g;
    const sign = nRaw < 0 ? '−' : '';

    if (den === 1) {
      if (num === 1) return `${sign}${symbol}`;
      return `${sign}${num}${symbol}`;
    }
    if (num === 1) return `${sign}${symbol}/${den}`;
    return `${sign}${num}${symbol}/${den}`;
  }

  private gcd(a: number, b: number): number {
    a = Math.round(Math.abs(a));
    b = Math.round(Math.abs(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }

  // ── Shared X step (grid + labels must always agree) ──────────────────────

  /** Returns the X grid/label step for the current viewport format. */
  private xStep(vp: CanvasViewport): number {
    const unitPx = vp.unit * vp.scaleX;
    if (vp.xAxisFormat === 'pi')     return this.niceStepConst(unitPx, Math.PI);
    if (vp.xAxisFormat === 'e')      return this.niceStepConst(unitPx, Math.E);
    if (vp.xAxisFormat === 'custom') return this.niceStepConst(unitPx, vp.customConst.value);
    return this.t.niceStep(TARGET_GRID_PX, unitPx);
  }

  // ── Constant-aligned nice steps ──────────────────────────────────────────

  /**
   * Returns a "nice" step that is a fraction/multiple of `constVal`.
   * Works for any constant: π, e, T, L, etc.
   */
  private niceStepConst(unitPx: number, constVal: number): number {
    const rawStep    = TARGET_GRID_PX / unitPx;
    const candidates = [
      constVal / 4, constVal / 3, constVal / 2,
      constVal,
      2 * constVal, 5 * constVal, 10 * constVal,
      20 * constVal, 50 * constVal, 100 * constVal,
    ].filter(c => c > 0);
    return candidates.find(s => s >= rawStep) ?? candidates[candidates.length - 1];
  }

}
