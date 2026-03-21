export type SeriesType = "trigonometric" | "halfRange" | "complex";

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
  an?: SymbolicExpression;
  bn?: SymbolicExpression;
  cn?: SymbolicExpression;
}

export interface FourierResult {
  input: FourierInput | PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  series: SymbolicExpression;
  simplifications?: Record<string, SymbolicExpression>;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface HalfRangeResult {
  input: PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  seriesCosine: SymbolicExpression;
  seriesSine: SymbolicExpression;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface ComplexFourierResult {
  input: PiecewiseFourierInput;
  coefficients: {
    c0: SymbolicExpression;
    cn: SymbolicExpression;
  };
  seriesComplex: SymbolicExpression;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface ComplexTerm {
  n: number;
  complex: SymbolicExpression;
  real: SymbolicExpression;
  amplitude: number;
  phase: number;
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
  };
}

export interface SimplifyResult {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  profile: SimplificationProfile;
  functionsApplied: SimplificationFunction[];
}
