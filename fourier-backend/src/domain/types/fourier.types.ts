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
  anK?: SymbolicExpression;
  anSummand?: SymbolicExpression;
  bn?: SymbolicExpression;
  bnK?: SymbolicExpression;
  bnSummand?: SymbolicExpression;
  cn?: SymbolicExpression;
  cnK?: SymbolicExpression;
  cnSummand?: SymbolicExpression;
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
  parseval?: ParsevalTrig;
  simplifications?: Record<string, SymbolicExpression>;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ParsevalFormal {
  k: SymbolicExpression;
  summand: SymbolicExpression;
  lhsFinal: SymbolicExpression;
}

export interface SingularTerm {
  n: number;
  tex: string;
  maxima: string;
  tex2x?: string;
}

export interface ParsevalTrig {
  lhs: SymbolicExpression;
  a0Term: SymbolicExpression;
  k: SymbolicExpression;
  summand: SymbolicExpression;
  lhsFinal: SymbolicExpression;
  sumStart: number;
  hasSingular: boolean;
  singVals: number[];
  singularTerms: SingularTerm[];
  formal?: ParsevalFormal;
}

export interface ParsevalHalfRange {
  lhs: SymbolicExpression;
  cosine: {
    a0Term: SymbolicExpression;
    k: SymbolicExpression;
    summand: SymbolicExpression;
    lhsFinal: SymbolicExpression;
    sumStart: number;
    hasSingular: boolean;
    singVals: number[];
    singularTerms: SingularTerm[];
    formal?: ParsevalFormal;
  };
  sine: {
    k: SymbolicExpression;
    summand: SymbolicExpression;
    lhsFinal: SymbolicExpression;
    sumStart: number;
    hasSingular: boolean;
    singVals: number[];
    singularTerms: SingularTerm[];
    formal?: ParsevalFormal;
  };
}

export interface ParsevalComplexBilateral {
  k: SymbolicExpression;
  lhsFinal: SymbolicExpression;
  formal?: {
    k: SymbolicExpression;
    lhsFinal: SymbolicExpression;
  };
}

export interface ParsevalComplex {
  lhs: SymbolicExpression;
  c0Term: SymbolicExpression;
  k: SymbolicExpression;
  summand: SymbolicExpression;
  lhsFinal: SymbolicExpression;
  sumStart: number;
  hasSingular: boolean;
  singVals: number[];
  singularTerms: SingularTerm[];
  formal?: ParsevalFormal;
  bilateral?: ParsevalComplexBilateral;
}

export interface ParsevalApiResult {
  parseval: ParsevalTrig | ParsevalHalfRange | ParsevalComplex | undefined;
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
  parseval?: ParsevalHalfRange;
  simplifications?: Record<string, SymbolicExpression>;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ComplexFourierResult {
  input: PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  seriesComplex: SymbolicExpression;
  w0: SymbolicExpression;
  parseval?: ParsevalComplex;
  simplifications?: Record<string, SymbolicExpression>;
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
  | "polarform"
  | "to_hyper";

export interface SimplifyInput {
  expression: string;
  profile: SimplificationProfile;
  functions?: SimplificationFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
    erfRepresentation?: "erf" | "erfc" | "erfi";
    declareNInteger?: boolean;
    toHyperbolic?: boolean;
  };
  convention?: NormalizationConvention;
  splitVar?: string;
  baseK?: string;
}

export interface SimplifyResult {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  simplifiedK?: SymbolicExpression;
  simplifiedSummand?: SymbolicExpression;
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
  /** Alternative display form for F (e.g. sech or sinh/(cosh+1)) shown in "Otras formas". */
  FAlt?: SymbolicExpression;
  realPart?: SymbolicExpression;
  realPartAlt?: SymbolicExpression;
  imagPart?: SymbolicExpression;
  imagPartAlt?: SymbolicExpression;
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

// ── Fourier Integral ──────────────────────────────────────────────────────────

export type FourierIntegralVariant = "trigonometric" | "complex" | "cosine" | "sine";

export interface FourierIntegralInput {
  segments: PiecewiseSegment[];
  intVar?: string;    // default "v"
  transVar?: string;  // default "w"
  variant: FourierIntegralVariant;
}

export interface FourierIntegralReconstructInput {
  segments: PiecewiseSegment[];
  intVar?: string;    // default "v"
  transVar?: string;  // default "w"
  variant: FourierIntegralVariant;
  upperLimit: number; // the "a" in ∫₀ᵃ (slider value)
  xMin: number;
  xMax: number;
  nPoints?: number;   // default 200
}


export interface FourierIntegralCoefficientsResult {
  input: FourierIntegralInput;
  exists: boolean;
  fourierIntegralTex?: string;  // complete Fourier Integral formula f(x) = ∫...
  integrand?: SymbolicExpression;         // A(w)cos(wx) + B(w)sin(wx) for alt-forms
  integrandK?: SymbolicExpression;        // constant factor K (free of w) extracted from integrand
  integrandSummand?: SymbolicExpression;  // integrand / K (the part inside the integral after factoring out K)
  // Trigonometric / cosine / sine variants
  A?: SymbolicExpression;  // A(w) cosine coefficient
  B?: SymbolicExpression;  // B(w) sine coefficient
  // Complex variant
  C?: SymbolicExpression;  // C(w) complex coefficient
  // Real/imaginary of C(w) for complex variant
  realPart?: SymbolicExpression;
  imagPart?: SymbolicExpression;
  // Real/imaginary parts of input f
  inputRealPart?: SymbolicExpression;
  inputImagPart?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface FourierIntegralReconstructResult {
  input: FourierIntegralReconstructInput;
  points: DFTPoint[];  // reuse existing {x, y} type
  executionTimeMs: number;
}

// ── Laplace Transform ─────────────────────────────────────────────────────────

export interface LaplaceDirectInput {
  segments: PiecewiseSegment[];
  timeVar?: string;   // default "t"
  freqVar?: string;   // default "s"
}

export interface LaplaceInverseInput {
  expression: string; // F(s) in Maxima syntax
  freqVar?: string;   // default "s"
  timeVar?: string;   // default "t"
}

export interface LaplaceOdeInput {
  equation: string;   // e.g. "diff(y(t),t,2) + y(t) = sin(t)"
  unknown: string;    // e.g. "y(t)"
  timeVar?: string;   // default "t"
  initialConditions: Array<{ order: number; value: string }>;
}

export interface LaplaceDirectResult {
  input: LaplaceDirectInput;
  exists: boolean;
  F?: SymbolicExpression;   // F(s) = L{f(t)}
  params?: string[];
  executionTimeMs: number;
}

export interface LaplaceInverseResult {
  input: LaplaceInverseInput;
  exists: boolean;
  f?: SymbolicExpression;   // f(t) = L⁻¹{F(s)}
  inverseMethod?: "ilt" | "pwilt" | "failed";
  executionTimeMs: number;
}

export interface LaplaceOdeResult {
  input: LaplaceOdeInput;
  exists: boolean;
  solution?: SymbolicExpression; // y(t)
  executionTimeMs: number;
}
