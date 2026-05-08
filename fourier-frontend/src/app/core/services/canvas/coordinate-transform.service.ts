import { Injectable } from '@angular/core';
import { CanvasViewport, MathPoint, ScreenPoint } from './canvas.types';

/**
 * Pure coordinate transformation service.
 * All methods are stateless — they take a viewport snapshot and return values.
 *
 * Screen space  = physical canvas pixels (accounting for DPR)
 * CSS space     = logical CSS pixels (what the user sees)
 * Math space    = mathematical coordinates (x, y axes)
 *
 * Callers always work in math space; this service converts to/from screen space
 * for actual canvas rendering operations.
 */
@Injectable({ providedIn: 'root' })
export class CoordinateTransformService {

  // ── Math → Screen ─────────────────────────────────────────────────────────

  mathToScreenX(mathX: number, vp: CanvasViewport): number {
    const centerX = (vp.cssWidth  / 2) * vp.dpr;
    return centerX + (mathX - vp.originMath.x) * vp.unit * vp.scaleX * vp.dpr;
  }

  mathToScreenY(mathY: number, vp: CanvasViewport): number {
    const centerY = (vp.cssHeight / 2) * vp.dpr;
    // Y axis is inverted: positive math Y goes up on screen
    return centerY - (mathY - vp.originMath.y) * vp.unit * vp.scaleY * vp.dpr;
  }

  mathToScreen(p: MathPoint, vp: CanvasViewport): ScreenPoint {
    return {
      x: this.mathToScreenX(p.x, vp),
      y: this.mathToScreenY(p.y, vp),
    };
  }

  // ── Screen → Math ─────────────────────────────────────────────────────────

  screenToMathX(screenX: number, vp: CanvasViewport): number {
    const centerX = (vp.cssWidth  / 2) * vp.dpr;
    return vp.originMath.x + (screenX - centerX) / (vp.unit * vp.scaleX * vp.dpr);
  }

  screenToMathY(screenY: number, vp: CanvasViewport): number {
    const centerY = (vp.cssHeight / 2) * vp.dpr;
    return vp.originMath.y - (screenY - centerY) / (vp.unit * vp.scaleY * vp.dpr);
  }

  screenToMath(p: ScreenPoint, vp: CanvasViewport): MathPoint {
    return {
      x: this.screenToMathX(p.x, vp),
      y: this.screenToMathY(p.y, vp),
    };
  }

  // ── CSS → Math (for event coordinates) ───────────────────────────────────

  cssToMathX(cssX: number, vp: CanvasViewport): number {
    return this.screenToMathX(cssX * vp.dpr, vp);
  }

  cssToMathY(cssY: number, vp: CanvasViewport): number {
    return this.screenToMathY(cssY * vp.dpr, vp);
  }

  // ── Visible math range ────────────────────────────────────────────────────

  visibleRange(vp: CanvasViewport): {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
  } {
    return {
      xMin: this.screenToMathX(0, vp),
      xMax: this.screenToMathX(vp.cssWidth  * vp.dpr, vp),
      yMin: this.screenToMathY(vp.cssHeight * vp.dpr, vp),
      yMax: this.screenToMathY(0, vp),
    };
  }

  // ── Nice grid step (1-2-5 × 10ⁿ algorithm) ───────────────────────────────

  /**
   * Returns a "nice" grid step size given a target pixel spacing.
   * Produces steps like 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50 …
   *
   * @param targetPixels  desired spacing between grid lines in CSS pixels
   * @param unit          current zoom (CSS pixels per math unit)
   */
  niceStep(targetPixels: number, unit: number): number {
    const rawStep = targetPixels / unit;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;

    let nice: number;
    if      (normalized < 1.5) nice = 1;
    else if (normalized < 3.5) nice = 2;
    else if (normalized < 7.5) nice = 5;
    else                       nice = 10;

    return nice * magnitude;
  }
}
