import express, { Application } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./api/swagger";
import { fourierRouter } from "./api/routes/fourier.routes";
import { dftRouter } from "./api/routes/dft.routes";
import { simplifyRouter } from "./api/routes/simplify.routes";
import { transformsRouter } from "./api/routes/transforms.routes";
import { cacheRouter } from "./api/routes/cache.routes";
import { errorHandler } from "./api/middlewares/errorHandler";
import { generalLimiter, computeLimiter } from "./api/middlewares/rateLimiter";
import { authRouter } from "./api/routes/auth.routes";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "./api/middlewares/authenticate";
import { requireVerified } from "./api/middlewares/requireVerified";
import { requireTierLimit } from "./api/middlewares/requireTierLimit";
import { historyRouter } from "./api/routes/history.routes";

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(generalLimiter);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/cache", cacheRouter);

  // Endpoints de cálculo: requieren auth + email verificado + rate limit
  app.use(
    "/api/fourier",
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    fourierRouter,
  );
  app.use(
    "/api/simplify",
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    simplifyRouter,
  );
  app.use(
    "/api/transforms",
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    transformsRouter,
  );
  app.use(
    "/api/dft",
    dftRouter,
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
  );

  app.use("/api/auth", authRouter);

  app.use("/api/history", historyRouter);

  app.use(errorHandler);

  return app;
}
