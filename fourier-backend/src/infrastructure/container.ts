import { MaximaRunner } from "./maxima/maximaRunner";
import { MaximaPostProcessor } from "./postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";
import { SimplifyService } from "../application/auxiliary/simplifyService";
import { TrigonometricService } from "../application/fourier/trigonometric.service";
import { HalfRangeService } from "../application/fourier/halfRange.service";
import { ComplexService } from "../application/fourier/complex.service";
import { FourierTransformService } from "../application/transforms/fourierTransform.service";
import { DFTService } from "../application/transforms/dft.service";

const runner = new MaximaRunner();
const postProcessor = new MaximaPostProcessor(runner);
const auxiliaryService = new AuxiliaryService(runner);
const simplifyService = new SimplifyService(runner);
const trigonometricService = new TrigonometricService(
  runner,
  postProcessor,
  auxiliaryService,
);
const halfRangeService = new HalfRangeService(
  runner,
  postProcessor,
  auxiliaryService,
);
const complexService = new ComplexService(
  runner,
  postProcessor,
  auxiliaryService,
);
const fourierTransformService = new FourierTransformService(runner);
const dftService = new DFTService(runner);

export {
  runner,
  postProcessor,
  auxiliaryService,
  simplifyService,
  trigonometricService,
  halfRangeService,
  complexService,
  fourierTransformService,
  dftService,
};
