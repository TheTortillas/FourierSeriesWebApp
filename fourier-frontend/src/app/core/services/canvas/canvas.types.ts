/**
 * Immutable snapshot of the canvas viewport state.
 * All rendering services receive this value object — no mutable shared state.
 */
/** User-defined constant for the 'custom' X-axis format (e.g. T=2.5, L=3) */
export interface AxisConst {
  /** Display symbol: single letter A-Z (not x, y) */
  symbol: string;
  /** Numeric value of the constant */
  value: number;
}

export interface CanvasViewport {
  /** CSS width of the canvas element (logical pixels) */
  cssWidth: number;
  /** CSS height of the canvas element (logical pixels) */
  cssHeight: number;
  /** Device pixel ratio (1 on standard, 2+ on HiDPI/Retina) */
  dpr: number;
  /** Zoom level: how many physical pixels represent one math unit */
  unit: number;
  /** Math coordinate at the center of the canvas */
  originMath: { x: number; y: number };
  /** X-axis label format */
  xAxisFormat: 'integer' | 'pi' | 'e' | 'custom';
  /** Used when xAxisFormat === 'custom' */
  customConst: AxisConst;
  /** Independent scale multipliers (for non-square aspect ratios) */
  scaleX: number;
  scaleY: number;
}

/** A 2D point in mathematical space */
export interface MathPoint {
  x: number;
  y: number;
}

/** A 2D point in canvas (physical pixel) space */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * How to render known discontinuities (vertical jumps between pieces).
 *
 * - `'none'`   — lift the pen and draw nothing at the jump (mathematically clean).
 * - `'solid'`  — draw a solid vertical line from y₁ to y₂ at the jump x.
 * - `'dashed'` — draw a dashed vertical line at the jump x (academic convention).
 *
 * Only used when the caller supplies explicit `discontinuities` on the `Curve`,
 * or when `PlottingService.plotPiecewise` auto-detects shared boundary x-values
 * between adjacent finite pieces.
 */
export type JumpStyle = 'none' | 'solid' | 'dashed';

/** A known discontinuity point: x position + left (y1) and right (y2) y-values. */
export interface Discontinuity {
  /** Math x-coordinate of the jump */
  x: number;
  /** y-value of the piece ending at this x (left limit) */
  y1: number;
  /** y-value of the piece starting at this x (right limit) */
  y2: number;
}

/** A continuous curve to be rendered */
export interface Curve {
  /** Sampled points in math space */
  points: MathPoint[];
  color: string;
  lineWidth: number;
  /** If true, render as dashed line */
  dashed?: boolean;
  /** Custom dash pattern passed to setLineDash. Defaults to [6,4] when dashed is true. */
  dashPattern?: number[];
  /**
   * How to render known discontinuities. Defaults to `'none'` (pen lifted,
   * nothing drawn at the jump). Set to `'solid'` or `'dashed'` to draw a
   * vertical marker line at each entry in `discontinuities`.
   */
  jumpStyle?: JumpStyle;
  /**
   * Explicit discontinuity points. When provided alongside `jumpStyle`,
   * `drawCurve` draws (or skips) a vertical segment at each position.
   *
   * Populated automatically by `PlottingService.plotPiecewise` from the
   * shared boundary x-values between adjacent finite pieces — callers
   * using that method do not need to supply this manually.
   */
  discontinuities?: Discontinuity[];
}

/** Visual theme tokens for the canvas */
export interface CanvasTheme {
  bg: string;
  axis: string;
  gridMajor: string;
  gridMinor: string;
  label: string;
}

export const LIGHT_THEME: CanvasTheme = {
  bg: '#faf7f2',
  axis: '#1a1410',
  gridMajor: '#c8bca8',
  gridMinor: '#e5dfd5',
  label: '#6b5e4e',
};

export const DARK_THEME: CanvasTheme = {
  bg: '#1a1410',
  axis: '#e8e0d0',
  gridMajor: '#3a3228',
  gridMinor: '#2a2420',
  label: '#8a7a6a',
};

export const NEUTRAL_LIGHT_THEME: CanvasTheme = {
  bg: '#fafafa',
  axis: '#1a1a1a',
  gridMajor: '#d4d4d4',
  gridMinor: '#ececec',
  label: '#6b6b6b',
};

export const NEUTRAL_DARK_THEME: CanvasTheme = {
  bg: '#1a1a1a',
  axis: '#f5f5f5',
  gridMajor: '#3a3a3a',
  gridMinor: '#2a2a2a',
  label: '#a0a0a0',
};

/** Fourier series types supported by the backend */
export type FourierSeriesType = 'trigonometric' | 'complex' | 'halfRange';

// ── Render configuration ───────────────────────────────────────────────────────

/**
 * All rendering tunables in one place.
 *
 * Pass a `Partial<CanvasRenderConfig>` to `FunctionPlotComponent` via the
 * `[renderConfig]` input; unspecified keys fall back to `DEFAULT_RENDER_CONFIG`.
 *
 * Having these as data (rather than module-level `const`) makes the canvas
 * components library-ready: callers can override fonts, grid density, zoom
 * limits, etc. without touching service code.
 */
export interface CanvasRenderConfig {
  // ── Grid & labels ──────────────────────────────────────────────────────────
  /** Target spacing between major grid lines, in CSS pixels. Default: 80 */
  targetGridPx: number;
  /** Minimum CSS-pixel gap between consecutive axis labels (prevents overlap). Default: 44 */
  minLabelGap: number;
  /** Font size for axis tick labels, in CSS pixels. Default: 11 */
  labelFontSize: number;
  /** CSS font-family string for axis tick labels. Default: 'JetBrains Mono, monospace' */
  labelFont: string;

  // ── Axes ───────────────────────────────────────────────────────────────────
  /** Stroke width of the X and Y axes, in CSS pixels. Default: 1.5 */
  axisLineWidth: number;

  // ── Curve sampling & discontinuity ─────────────────────────────────────────
  /**
   * Maximum allowed vertical jump (CSS pixels) between two consecutive sampled
   * points before the path is broken (discontinuity detection). Default: 120
   */
  maxJumpPx: number;
  /**
   * Base oversample factor: `sampleVisible` uses `cssWidth × defaultOversample`
   * samples, then clamps upward if the canvas is very wide. Default: 2
   */
  defaultOversample: number;

  // ── Zoom limits ─────────────────────────────────────────────────────────────
  /** Minimum allowed `unit` value (most zoomed-out). Default: 1e-4 */
  minUnit: number;
  /** Maximum allowed `unit` value (most zoomed-in). Default: 1e9 */
  maxUnit: number;
}

/**
 * Production defaults — match the values that were previously hardcoded
 * across `canvas-renderer.service.ts`, `plotting.service.ts`, and
 * `function-plot.component.ts`.
 *
 * Callers that do not pass `[renderConfig]` get exactly the same behaviour
 * as before this refactor.
 */
export const DEFAULT_RENDER_CONFIG: CanvasRenderConfig = {
  targetGridPx:    80,
  minLabelGap:     44,
  labelFontSize:   11,
  labelFont:       'JetBrains Mono, monospace',
  axisLineWidth:   1.5,
  maxJumpPx:       120,
  defaultOversample: 2,
  minUnit:         1e-4,
  maxUnit:         1e9,
};
