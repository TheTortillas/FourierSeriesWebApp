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
  executionTimeMs: number;
}

export interface InverseFourierResult {
  condition: string;
  f: SymbolicExpression;
}

export interface InverseFourierTransformResponse {
  input: InverseFourierTransformRequest;
  exists: boolean;
  results?: InverseFourierResult[];
  executionTimeMs: number;
}

// ─── Simplify ─────────────────────────────────────────────────────────────────

export type SimplifyProfile =
  | 'raw'
  | 'integer'
  | 'trigonometric'
  | 'exponential'
  | 'complete';

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
  };
}

export interface SimplifyResponse {
  original: SymbolicExpression;
  simplified: SymbolicExpression;
  profile: SimplifyProfile;
  functionsApplied: SimplifyFunction[];
}
