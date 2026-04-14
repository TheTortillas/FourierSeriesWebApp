import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./api/swagger";
import { fourierRouter } from "./api/routes/fourier.routes";
import { dftRouter } from "./api/routes/dft.routes";
import { simplifyRouter } from "./api/routes/simplify.routes";
import { transformsRouter } from "./api/routes/transforms.routes";
import { cacheRouter } from "./api/routes/cache.routes";
import { errorHandler } from "./api/middlewares/errorHandler";
import {
  generalLimiter,
  computeLimiter,
  parseBurstLimiter,
  parseSustainedLimiter,
  authLimiter,
  trackRateLimitRequests,
} from "./api/middlewares/rateLimiter";
import { authRouter } from "./api/routes/auth.routes";
import { optionalAuth } from "./api/middlewares/authenticate";
import { requireVerified } from "./api/middlewares/requireVerified";
import { requireTierLimit } from "./api/middlewares/requireTierLimit";
import { historyRouter } from "./api/routes/history.routes";
import { parseRouter } from "./api/routes/parse.routes";
import { adminRouter } from "./api/routes/admin.routes";
import { config } from "./config/env";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());

  app.use(
    cors({
      origin: config.cors.allowedOrigins,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());

  app.use(generalLimiter);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/cache", cacheRouter);

  // Endpoints de cálculo: requieren auth + email verificado + rate limit
  app.use(
    "/api/fourier",
    trackRateLimitRequests("compute"),
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    fourierRouter,
  );
  app.use(
    "/api/simplify",
    trackRateLimitRequests("compute"),
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    simplifyRouter,
  );
  app.use(
    "/api/transforms",
    trackRateLimitRequests("compute"),
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    transformsRouter,
  );
  app.use(
    "/api/dft",
    trackRateLimitRequests("compute"),
    optionalAuth,
    requireVerified,
    requireTierLimit,
    computeLimiter,
    dftRouter,
  );

  app.use(
    "/api/parse",
    trackRateLimitRequests("parse"),
    optionalAuth,
    parseBurstLimiter,
    parseSustainedLimiter,
    parseRouter,
  );

  app.use("/api/auth", trackRateLimitRequests("auth"), authLimiter, authRouter);

  app.use("/api/history", historyRouter);

  app.use("/api/admin", adminRouter);

  app.use(errorHandler);

  return app;
}
