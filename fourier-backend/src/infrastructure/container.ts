import { MaximaRunner } from "./maxima/maximaRunner";
import { MaximaPostProcessor } from "./postprocessor/maximaPostProcessor";
import { AuxiliaryService } from "../application/auxiliary/auxiliaryService";
import { SimplifyService } from "../application/auxiliary/simplifyService";
import { TrigonometricService } from "../application/fourier/trigonometric.service";
import { HalfRangeService } from "../application/fourier/halfRange.service";
import { ComplexService } from "../application/fourier/complex.service";
import { FourierTransformService } from "../application/transforms/fourierTransform.service";
import { DFTService } from "../application/transforms/dft.service";

import { UserRepository } from "./persistence/UserRepository";
import { TokenRepository } from "./persistence/TokenRepository";
import { AuditRepository } from "./persistence/AuditRepository";
import { TokenService } from "../application/auth/tokenService";
import { AuthService } from "../application/auth/authService";

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

const userRepository = new UserRepository();
const tokenRepository = new TokenRepository();
const auditRepository = new AuditRepository();
const tokenService = new TokenService();
const authService = new AuthService(
  userRepository,
  tokenRepository,
  auditRepository,
  tokenService,
);

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
  userRepository,
  tokenRepository,
  auditRepository,
  tokenService,
  authService,
};
