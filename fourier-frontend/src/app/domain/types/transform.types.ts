import { Segment, SymbolicExpression } from './common.types';

// ─── Normalization convention ─────────────────────────────────────────────────

/**
 * Normalization convention for the Fourier Transform pair.
 *
 * | id          | FT factor   | IFT factor  |
 * |-------------|-------------|-------------|
 * | engineering | 1           | 1/(2π)      |
 * | physics     | 1/√(2π)     | 1/√(2π)    |
 * | ordinary    | 1           | 1           |
 */
export type NormalizationConvention = 'engineering' | 'physics' | 'ordinary';

// ─── Requests ────────────────────────────────────────────────────────────────

export interface FourierTransformRequest {
  segments: Segment[];
  intVar?: string;
  transVar?: string;
  convention?: NormalizationConvention;
}

export interface InverseFourierTransformRegion {
  condition: string;
  description?: string;
}

export interface InverseFourierTransformRequest {
  segments: Segment[];
  intVar?: string;
  transVar?: string;
  regions?: InverseFourierTransformRegion[];
  convention?: NormalizationConvention;
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface FourierTransformResponse {
  input: FourierTransformRequest;
  exists: boolean;
  F?: SymbolicExpression;
  /** Alternative display form for F (e.g. sech or sinh/(cosh+1)) shown in "Otras formas". */
  FAlt?: SymbolicExpression;
  realPart?: SymbolicExpression;
  realPartAlt?: SymbolicExpression;
  imagPart?: SymbolicExpression;
  imagPartAlt?: SymbolicExpression;
  /** Real part of the input f(t) after piecewise normalization (for plotting). */
  inputRealPart?: SymbolicExpression;
  /** Imaginary part of the input f(t) after piecewise normalization (for plotting). */
  inputImagPart?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface InverseFourierTransformResponse {
  input: InverseFourierTransformRequest;
  exists: boolean;
  /** Recovered function for the region where the time variable > 0 */
  fPositive?: SymbolicExpression;
  /** Recovered function for the region where the time variable < 0 */
  fNegative?: SymbolicExpression;
  /** Combined/simplified form when both regions yield a clean expression */
  fCombined?: SymbolicExpression;
  /** u(t) combined form: f_pos·u(t) + f_neg·u(−t) */
  fOutUForm?: SymbolicExpression;
  /** Real part of the input F(ω) (for canvas plotting) */
  inputRealPart?: SymbolicExpression;
  /** Imaginary part of the input F(ω) (for canvas plotting) */
  inputImagPart?: SymbolicExpression;
  /** Real part of reconstructed f(t) — combined form (for canvas plotting) */
  outputRealPart?: SymbolicExpression;
  /** Imaginary part of reconstructed f(t) — combined form (for canvas plotting) */
  outputImagPart?: SymbolicExpression;
  /** Real part of f(t) for t > 0 */
  outputRealPartPositive?: SymbolicExpression;
  /** Real part of f(t) for t < 0 */
  outputRealPartNegative?: SymbolicExpression;
  /** Imaginary part of f(t) for t > 0 */
  outputImagPartPositive?: SymbolicExpression;
  /** Imaginary part of f(t) for t < 0 */
  outputImagPartNegative?: SymbolicExpression;
  /** Real part of f_out_u_form: Re(f_pos·u(t) + f_neg·u(−t)) */
  outputRealUForm?: SymbolicExpression;
  /** Imaginary part of f_out_u_form */
  outputImagUForm?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

// ─── Fourier Integral ─────────────────────────────────────────────────────────

export type FourierIntegralVariant = 'trigonometric' | 'complex' | 'cosine' | 'sine';

export interface FourierIntegralRequest {
  segments: Segment[];
  intVar?: string;
  transVar?: string;
  variant: FourierIntegralVariant;
}

export interface FourierIntegralReconstructRequest {
  segments: Segment[];
  intVar?: string;
  transVar?: string;
  variant: FourierIntegralVariant;
  upperLimit: number;
  xMin: number;
  xMax: number;
  nPoints?: number;
}

export interface FourierIntegralCoefficientsResponse {
  input: FourierIntegralRequest;
  exists: boolean;
  fourierIntegralTex?: string;
  integrand?: SymbolicExpression;
  integrandK?: SymbolicExpression;
  integrandSummand?: SymbolicExpression;
  A?: SymbolicExpression;
  B?: SymbolicExpression;
  C?: SymbolicExpression;
  realPart?: SymbolicExpression;
  imagPart?: SymbolicExpression;
  inputRealPart?: SymbolicExpression;
  inputImagPart?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface ReconstructPoint {
  x: number;
  y: number;
}

export interface FourierIntegralReconstructResponse {
  input: FourierIntegralReconstructRequest;
  points: ReconstructPoint[];
  executionTimeMs: number;
}


// ─── Simplify ─────────────────────────────────────────────────────────────────

export type SimplifyProfile = 'raw' | 'integer' | 'trigonometric' | 'exponential' | 'complete';

export type SimplifyFunction =
  | 'fullratsimp'
  | 'ratsimp'
  | 'trigsimp'
  | 'trigreduce'
  | 'trigexpand'
  | 'factor'
  | 'expand'
  | 'radcan'
  | 'rectform'
  | 'polarform'
  | 'combine'
  | 'to_hyper';

export interface SimplifyRequest {
  expression: string;
  profile: SimplifyProfile;
  functions?: SimplifyFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
    erfRepresentation?: 'erf' | 'erfc' | 'erfi';
    declareNInteger?: boolean;
    toHyperbolic?: boolean;
  };
  convention?: NormalizationConvention;
  splitVar?: string;
  baseK?: string;
}

export interface SimplifyResponse {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  simplifiedK?: SymbolicExpression;
  simplifiedSummand?: SymbolicExpression;
  profile: SimplifyProfile;
  functionsApplied: SimplifyFunction[];
}

// ─── Laplace ──────────────────────────────────────────────────────────────────

export interface LaplaceDirectRequest {
  segments: Segment[];
  timeVar?: string;
  freqVar?: string;
}

export interface LaplaceInverseRequest {
  expression: string;
  freqVar?: string;
  timeVar?: string;
}

export interface LaplaceIcCondition {
  order: number;
  value: string;
}

export interface LaplaceOdeRequest {
  equation: string;
  unknown: string;
  timeVar?: string;
  initialConditions: LaplaceIcCondition[];
}

export interface LaplaceDirectResponse {
  input: LaplaceDirectRequest;
  exists: boolean;
  F?: SymbolicExpression;
  params?: string[];
  executionTimeMs: number;
}

export interface LaplaceInverseResponse {
  input: LaplaceInverseRequest;
  exists: boolean;
  f?: SymbolicExpression;
  inverseMethod: 'ilt' | 'pwilt' | 'failed';
  executionTimeMs: number;
}

export interface LaplaceOdeResponse {
  input: LaplaceOdeRequest;
  exists: boolean;
  solution?: SymbolicExpression;
  executionTimeMs: number;
}
