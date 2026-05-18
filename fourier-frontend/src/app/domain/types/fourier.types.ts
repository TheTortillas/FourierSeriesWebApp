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
  pointTex?: string;
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
  anK?: SymbolicExpression;
  anSummand?: SymbolicExpression;
  bn?: SymbolicExpression;
  bnK?: SymbolicExpression;
  bnSummand?: SymbolicExpression;
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

export interface ParsevalResponse {
  parseval: ParsevalTrig | ParsevalHalfRange | ParsevalComplex | undefined;
  executionTimeMs: number;
}

export interface TrigonometricResponse {
  input: FourierSeriesRequest;
  coefficients: TrigonometricCoefficients;
  series: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  parseval?: ParsevalTrig;
  validation?: ValidationResult;
  params?: string[];
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
  validation?: ValidationResult;
}

export interface HalfRangeResponse {
  input: FourierSeriesRequest;
  coefficients: TrigonometricCoefficients;
  seriesCosine: SymbolicExpression;
  seriesSine: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  parseval?: ParsevalHalfRange;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ComplexCoefficients {
  c0: SymbolicExpression;
  c0Float?: number;
  cn: SymbolicExpression;
  cnK?: SymbolicExpression;
  cnSummand?: SymbolicExpression;
}

export interface ComplexResponse {
  input: FourierSeriesRequest;
  coefficients: ComplexCoefficients;
  seriesComplex: SymbolicExpression;
  w0: SymbolicExpression;
  parseval?: ParsevalComplex;
  validation?: ValidationResult;
  params?: string[];
  executionTimeMs: number;
}

export interface ComplexTerm {
  n: number;
  cn: SymbolicExpression;
  cnNeg: SymbolicExpression;
  real: SymbolicExpression;
  cnRe?: string; // Re(cn) as symbolic Maxima expression, free of %i
  cnIm?: string; // Im(cn) as symbolic Maxima expression, free of %i
  cosFloat: number; // coefficient for cos(n·w0·x) in the real reconstruction
  sinFloat: number; // coefficient for sin(n·w0·x) in the real reconstruction
  amplitude: number; // |cₙ| for spectrum display
  phase: number; // ∠cₙ for spectrum display
  cnUsedLimit?: boolean;
  cnNegUsedLimit?: boolean;
}

export interface ComplexTermsResponse {
  terms: ComplexTerm[];
  executionTimeMs: number;
  validation?: ValidationResult;
}

// ─── Simplify (Fourier-domain aliases) ───────────────────────────────────────

export type SimplificationProfile =
  | 'raw'
  | 'integer'
  | 'trigonometric'
  | 'exponential'
  | 'complete';

export type SimplificationFunction =
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
  | 'to_hyper';

export interface SimplifyInput {
  expression: string;
  profile: SimplificationProfile;
  functions?: SimplificationFunction[];
  displayFlags?: {
    edispflag?: boolean;
    exponentialize?: boolean;
    demoivre?: boolean;
    erfRepresentation?: 'erf' | 'erfc' | 'erfi';
    declareNInteger?: boolean;
    toHyperbolic?: boolean;
  };
}

export interface SimplifyResult {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  simplifiedK?: SymbolicExpression;
  simplifiedSummand?: SymbolicExpression;
  profile: SimplificationProfile;
  functionsApplied: SimplificationFunction[];
}
