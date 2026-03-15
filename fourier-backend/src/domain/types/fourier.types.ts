export type SeriesType = "trigonometric" | "halfRange" | "complex";

export interface FourierInput {
  func: string;
  period: number;
  seriesType: SeriesType;
}

export interface PiecewiseSegment {
  expression: string;
  from: string;
  to: string;
}

export interface PiecewiseFourierInput {
  segments: PiecewiseSegment[];
  period: number;
  seriesType: SeriesType;
}

export interface FourierCoefficients {
  a0?: string;
  an?: string;
  bn?: string;
  cn?: string;
}

export interface FourierResult {
  input: FourierInput | PiecewiseFourierInput;
  coefficients: FourierCoefficients;
  series: string;
  simplifications?: Record<string, string>;
  executionTimeMs: number;
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
