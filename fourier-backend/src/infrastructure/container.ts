import { MaximaRunner } from "./maxima/maximaRunner";
import { MaximaPostProcessor } from "./postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";

const runner = new MaximaRunner();
const postProcessor = new MaximaPostProcessor(runner);
const auxiliaryService = new AuxiliaryService(runner);

export { runner, postProcessor, auxiliaryService };
