export type DftMode = 'signal' | 'epicycles';

export interface DftPoint {
  x: number;
  y: number;
}

export interface DftRequest {
  points: DftPoint[];
  mode: DftMode;
  N?: number;
}

export interface DftCoefficient {
  k: number;
  re: number;
  im: number;
  amplitude: number;
  amplitudePercent: number;
  phase: number;
  phaseInPi: string;
  freq: number;
}

export interface DftResponse {
  mode: DftMode;
  N: number;
  coefficients: DftCoefficient[];
  topCoefficients: DftCoefficient[];
  reconstructed: DftPoint[];
  rmsError: number;
  executionTimeMs: number;
}

// ── DFT from function ─────────────────────────────────────────────────────────

export interface DftSegment {
  expression: string;
  from: string;
  to: string;
}

export interface DftFunctionRequest {
  segments: DftSegment[];
  intVar?: string;
  N: number;
}

export interface DftFunctionResponse extends DftResponse {
  sampledPoints: DftPoint[];
  interval: { a: number; b: number };
}
