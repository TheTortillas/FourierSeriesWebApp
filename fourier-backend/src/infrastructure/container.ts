import { MaximaRunner } from "./maxima/maximaRunner";
import { MaximaPostProcessor } from "./postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";
import { TrigonometricService } from "../application/fourier/trigonometric.service";

const runner = new MaximaRunner();
const postProcessor = new MaximaPostProcessor(runner);
const auxiliaryService = new AuxiliaryService(runner);
const trigonometricService = new TrigonometricService(
  runner,
  postProcessor,
  auxiliaryService,
);

export { runner, postProcessor, auxiliaryService, trigonometricService };
