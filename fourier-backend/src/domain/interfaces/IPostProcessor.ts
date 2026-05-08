import type { FourierResult, SymbolicExpression } from "../types/fourier.types";

export interface IPostProcessor {
  canProcess(expr: SymbolicExpression): boolean;
  process(result: FourierResult): Promise<FourierResult>;
}
