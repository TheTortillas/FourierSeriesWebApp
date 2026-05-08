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

/** A continuous curve to be rendered */
export interface Curve {
  /** Sampled points in math space */
  points: MathPoint[];
  color: string;
  lineWidth: number;
  /** If true, render as dashed line */
  dashed?: boolean;
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
