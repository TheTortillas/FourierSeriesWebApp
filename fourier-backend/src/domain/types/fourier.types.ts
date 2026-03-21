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
  an?: SymbolicExpression;
  bn?: SymbolicExpression;
  cn?: SymbolicExpression;
}

export interface FourierResult {
  input: FourierInput | PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  series: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
  simplifications?: Record<string, SymbolicExpression>;
  validation?: ValidationResult;
  executionTimeMs: number;
}

export interface HalfRangeResult {
  input: PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  seriesCosine: SymbolicExpression;
  seriesSine: SymbolicExpression;
  w0: SymbolicExpression;
  a0Raw?: SymbolicExpression;
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
  w0: SymbolicExpression;
  validation?: ValidationResult;
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

export interface TrigonometricTerm {
  n: number;
  an: SymbolicExpression;
  bn: SymbolicExpression;
  anFloat: number;
  bnFloat: number;
}

export interface HalfRangeTerm {
  n: number;
  an: SymbolicExpression;
  bn: SymbolicExpression;
  anFloat: number;
  bnFloat: number;
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

export interface TrigonometricTermsResult {
  terms: TrigonometricTerm[];
  executionTimeMs: number;
}

export interface HalfRangeTermsResult {
  terms: HalfRangeTerm[];
  executionTimeMs: number;
}

export interface ComplexTermsResult {
  terms: ComplexTerm[];
  executionTimeMs: number;
}

export interface FourierTransformInput {
  segments: PiecewiseSegment[];
  intVar?: string;
  transVar?: string;
}

export interface FourierTransformResult {
  input: FourierTransformInput;
  exists: boolean;
  F?: SymbolicExpression;
  realPart?: SymbolicExpression;
  imagPart?: SymbolicExpression;
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
}

export interface InverseFourierTransformRegionResult {
  condition: string;
  f: SymbolicExpression;
}

export interface InverseFourierTransformResult {
  input: InverseFourierTransformInput;
  exists: boolean;
  results?: InverseFourierTransformRegionResult[];
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
