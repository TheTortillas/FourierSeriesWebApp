import { FourierResult } from "../types/fourier.types";

export interface IPostProcessor {
  process(result: FourierResult): Promise<FourierResult>;
}
