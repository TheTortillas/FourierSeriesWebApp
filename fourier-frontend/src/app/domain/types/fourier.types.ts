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
  realFloat: number;
  amplitude: number;
  phase: number;
}

export interface ComplexTermsResponse {
  terms: ComplexTerm[];
  executionTimeMs: number;
}
