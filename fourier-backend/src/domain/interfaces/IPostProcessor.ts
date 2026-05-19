import type { FourierCoefficients, SymbolicExpression } from "../types/fourier.types";

export interface CleanableSeriesResult {
  coefficients: FourierCoefficients;
  simplifications?: Record<string, SymbolicExpression>;
}

export interface IPostProcessor {
  canProcess(expr: SymbolicExpression): boolean;
  process<T extends CleanableSeriesResult>(result: T): Promise<T>;
}
