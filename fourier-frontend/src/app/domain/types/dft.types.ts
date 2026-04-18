export type DftMode = 'signal' | 'epicycles';
export type DftAlgorithm = 'fft' | 'dft';
export type DftInputMode = 'function' | 'manual';

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

/** Response from POST /transforms/dft/sample — only samples, no DFT. */
export interface DftSampleResponse {
  sampledPoints: DftPoint[];
  interval: { a: number; b: number };
  samplingTimeMs: number;
}

/** Unified local result produced entirely in the frontend after receiving samples. */
export interface LocalDftResult {
  inputMode: DftInputMode;
  algorithm: DftAlgorithm;
  N: number;
  sampledPoints: DftPoint[];
  coefficients: DftCoefficient[];
  topCoefficients: DftCoefficient[];
  reconstructed: DftPoint[];
  rmsError: number;
  computeTimeMs: number;
  samplingTimeMs?: number;
  interval?: { a: number; b: number };
}
