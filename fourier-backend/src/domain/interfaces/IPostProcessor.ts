import type { FourierResult } from "../types/fourier.types";

export interface IPostProcessor {
  canProcess(raw: string): boolean;
  process(result: FourierResult): Promise<FourierResult>;
}
