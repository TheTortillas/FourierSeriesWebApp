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
