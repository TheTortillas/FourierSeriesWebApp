export type SeriesType = "trigonometric" | "halfRange" | "complex";
export type DFTMode = "signal" | "epicycles";

export interface FourierInput {
  func: string;
  seriesType: SeriesType;
}

export interface PiecewiseSegment {
  expression: string;
  from: string;
  to: string;
}

export interface PiecewiseFourierInput {
  segments: PiecewiseSegment[];
  seriesType: SeriesType;
  intVar?: string;
}

export interface FourierCoefficients {
  a0?: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  a0Float?: number;
  an?: SymbolicExpression;
  bn?: SymbolicExpression;
  cn?: SymbolicExpression;
  c0?: SymbolicExpression;
  c0Float?: number;
}

export interface FourierResult {
  input: FourierInput | PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  series: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  a0Float?: number;
  simplifications?: Record<string, SymbolicExpression>;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface HalfRangeResult {
  input: PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  seriesCosine: SymbolicExpression;
  seriesSine: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  a0Float?: number;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ComplexFourierResult {
  input: PiecewiseFourierInput;
  coefficients: {
    c0: SymbolicExpression;
    c0Float?: number;
    cn: SymbolicExpression;
  };
  seriesComplex: SymbolicExpression;
  w0: SymbolicExpression;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ComplexTermsResult {
  terms: ComplexTerm[];
}

export interface SymbolicExpression {
  tex: string;
  maxima: string;
}
export type SingularityType =
  | "removible"
  | "salto"
  | "asintotica"
  | "esencial"
  | "fuera_de_dominio";

export interface Singularity {
  point: string;
  pointTex?: string;
  type: SingularityType;
}

export type ValidationDecision = "proceed" | "warn" | "reject";

export interface ValidationResult {
  decision: ValidationDecision;
  singularities: Singularity[];
  message?: string;
}

export type SimplificationProfile =
  | "raw"
  | "integer"
  | "trigonometric"
  | "exponential"
  | "complete";

export type SimplificationFunction =
  | "fullratsimp"
  | "ratsimp"
  | "trigsimp"
  | "trigreduce"
  | "trigexpand"
  | "factor"
  | "expand"
  | "radcan"
  | "rectform"
  | "polarform";

export interface SimplifyInput {
  expression: string;
  profile: SimplificationProfile;
  functions?: SimplificationFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
    erfRepresentation?: "erf" | "erfc" | "erfi";
  };
  convention?: NormalizationConvention;
}

export interface SimplifyResult {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  profile: SimplificationProfile;
  functionsApplied: SimplificationFunction[];
}

export interface TrigonometricTerm {
  n: number;
  an: SymbolicExpression;
  bn: SymbolicExpression;
  anFloat: number;
  bnFloat: number;
  anUsedLimit?: boolean;
  bnUsedLimit?: boolean;
}

export interface HalfRangeTerm {
  n: number;
  an: SymbolicExpression;
  bn: SymbolicExpression;
  anFloat: number;
  bnFloat: number;
  anUsedLimit?: boolean;
  bnUsedLimit?: boolean;
}

export interface ComplexTerm {
  n: number;
  cn: SymbolicExpression;
  cnNeg: SymbolicExpression;
  real: SymbolicExpression;
  cnRe: string; // Re(cn) as symbolic Maxima expression, free of %i
  cnIm: string; // Im(cn) as symbolic Maxima expression, free of %i
  cosFloat: number;
  sinFloat: number;
  amplitude: number;
  phase: number;
  cnUsedLimit?: boolean;
  cnNegUsedLimit?: boolean;
}

export interface TrigonometricTermsResult {
  terms: TrigonometricTerm[];
  executionTimeMs: number;
  validation?: ValidationResult;
}

export interface HalfRangeTermsResult {
  terms: HalfRangeTerm[];
  executionTimeMs: number;
  validation?: ValidationResult;
}

export interface ComplexTermsResult {
  terms: ComplexTerm[];
  executionTimeMs: number;
  validation?: ValidationResult;
}

/**
 * Normalization convention for the Fourier Transform pair.
 *
 * | id          | FT factor   | IFT factor  |
 * |-------------|-------------|-------------|
 * | engineering | 1           | 1/(2π)      |
 * | physics     | 1/√(2π)     | 1/√(2π)    |
 * | ordinary    | 1           | 1           |
 */
export type NormalizationConvention = "engineering" | "physics" | "ordinary";

export interface FourierTransformInput {
  segments: PiecewiseSegment[];
  intVar?: string;
  transVar?: string;
  convention?: NormalizationConvention;
}

export interface FourierTransformResult {
  input: FourierTransformInput;
  exists: boolean;
  F?: SymbolicExpression;
  realPart?: SymbolicExpression;
  imagPart?: SymbolicExpression;
  inputRealPart?: SymbolicExpression;
  inputImagPart?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface TransformRegion {
  condition: string;
  description?: string;
}

export interface InverseFourierTransformInput {
  segments: PiecewiseSegment[];
  intVar?: string;
  transVar?: string;
  regions?: TransformRegion[];
  convention?: NormalizationConvention;
}

export interface InverseFourierTransformRegionResult {
  condition: string;
  f: SymbolicExpression;
}

export interface InverseFourierTransformResult {
  input: InverseFourierTransformInput;
  exists: boolean;
  fPositive?: SymbolicExpression;
  fNegative?: SymbolicExpression;
  fCombined?: SymbolicExpression;
  fOutUForm?: SymbolicExpression;
  inputRealPart?: SymbolicExpression;
  inputImagPart?: SymbolicExpression;
  outputRealPart?: SymbolicExpression;
  outputImagPart?: SymbolicExpression;
  outputRealPartPositive?: SymbolicExpression;
  outputRealPartNegative?: SymbolicExpression;
  outputImagPartPositive?: SymbolicExpression;
  outputImagPartNegative?: SymbolicExpression;
  outputRealUForm?: SymbolicExpression;
  outputImagUForm?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface DFTPoint {
  x: number;
  y: number;
}

export interface DFTCoefficient {
  k: number;
  re: number;
  im: number;
  amplitude: number;
  amplitudePercent: number;
  phase: number;
  phaseInPi: string;
  freq: number;
}

export interface DFTInput {
  points: DFTPoint[];
  mode: DFTMode;
  N?: number;
}

export interface DFTResult {
  mode: DFTMode;
  N: number;
  coefficients: DFTCoefficient[];
  topCoefficients: DFTCoefficient[];
  reconstructed: DFTPoint[];
  rmsError: number;
  executionTimeMs: number;
}

// ── DFT from function (Stage 1) ───────────────────────────────────────────────

export interface DFTFunctionInput {
  segments: PiecewiseSegment[];
  intVar?: string;
  N: number;
}

export interface DFTFunctionResult extends DFTResult {
  /** Sampled points from the original function (for plotting). */
  sampledPoints: DFTPoint[];
  /** Interval of the function [a, b]. */
  interval: { a: number; b: number };
}

/** Result of sampling a piecewise function without computing DFT. */
export interface DFTSampleResult {
  sampledPoints: DFTPoint[];
  interval: { a: number; b: number };
  samplingTimeMs: number;
}
