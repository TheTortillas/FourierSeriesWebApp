import { MaximaInput, MaximaResult } from "../types/maxima.types";

export interface IMaximaRunner {
  run(input: MaximaInput): Promise<MaximaResult>;
}
