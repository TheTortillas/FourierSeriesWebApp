import { Segment, SymbolicExpression } from './common.types';

// ─── Requests ────────────────────────────────────────────────────────────────

export interface FourierTransformRequest {
  segments: Segment[];
  intVar?: string;
  transVar?: string;
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
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface FourierTransformResponse {
  input: FourierTransformRequest;
  exists: boolean;
  F?: SymbolicExpression;
  realPart?: SymbolicExpression;
  imagPart?: SymbolicExpression;
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
  | 'polarform';

export interface SimplifyRequest {
  expression: string;
  profile: SimplifyProfile;
  functions?: SimplifyFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
    erfRepresentation?: 'erf' | 'erfc' | 'erfi';
  };
}

export interface SimplifyResponse {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  profile: SimplifyProfile;
  functionsApplied: SimplifyFunction[];
}
