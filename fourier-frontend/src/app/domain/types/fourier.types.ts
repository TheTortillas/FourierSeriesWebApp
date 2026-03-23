import { Segment, SymbolicExpression } from './common.types';

// ─── Requests ────────────────────────────────────────────────────────────────

export interface FourierSeriesRequest {
  segments: Segment[];
  seriesType: 'trigonometric' | 'complex' | 'halfRange';
  intVar?: string;
}

export interface FourierTermsRequest {
  input: FourierSeriesRequest;
  nTerms: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type SingularityType =
  | 'removible'
  | 'salto'
  | 'asintotica'
  | 'esencial'
  | 'fuera_de_dominio';

export type ValidationDecision = 'proceed' | 'warn' | 'reject';

export interface Singularity {
  point: string;
  type: SingularityType;
}

export interface ValidationResult {
  decision: ValidationDecision;
  singularities: Singularity[];
  message?: string;
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface TrigonometricCoefficients {
  a0?: SymbolicExpression;
  a0Float?: number;
  an?: SymbolicExpression;
  bn?: SymbolicExpression;
}

export interface TrigonometricResponse {
  input: FourierSeriesRequest;
  coefficients: TrigonometricCoefficients;
  series: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  validation?: ValidationResult;
  executionTimeMs: number;
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

export interface TrigonometricTermsResponse {
  terms: TrigonometricTerm[];
  executionTimeMs: number;
}

export interface HalfRangeResponse {
  input: FourierSeriesRequest;
  coefficients: TrigonometricCoefficients;
  seriesCosine: SymbolicExpression;
  seriesSine: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface ComplexCoefficients {
  c0: SymbolicExpression;
  c0Float?: number;
  cn: SymbolicExpression;
}

export interface ComplexResponse {
  input: FourierSeriesRequest;
  coefficients: ComplexCoefficients;
  seriesComplex: SymbolicExpression;
  w0: SymbolicExpression;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface ComplexTerm {
  n: number;
  cn: SymbolicExpression;
  cnNeg: SymbolicExpression;
  real: SymbolicExpression;
  cosFloat: number;   // coefficient for cos(n·w0·x) in the real reconstruction
  sinFloat: number;   // coefficient for sin(n·w0·x) in the real reconstruction
  amplitude: number;  // |cₙ| for spectrum display
  phase: number;      // ∠cₙ for spectrum display
  cnUsedLimit?: boolean;
  cnNegUsedLimit?: boolean;
}

export interface ComplexTermsResponse {
  terms: ComplexTerm[];
  executionTimeMs: number;
}

// ─── Simplify (Fourier-domain aliases) ───────────────────────────────────────

export type SimplificationProfile = 'raw' | 'integer' | 'trigonometric' | 'exponential' | 'complete';

export type SimplificationFunction =
  | 'fullratsimp' | 'ratsimp' | 'trigsimp' | 'trigreduce' | 'trigexpand'
  | 'factor' | 'expand' | 'radcan' | 'rectform' | 'polarform';

export interface SimplifyInput {
  expression: string;
  profile: SimplificationProfile;
  functions?: SimplificationFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
  };
}

export interface SimplifyResult {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  profile: SimplificationProfile;
  functionsApplied: SimplificationFunction[];
}
