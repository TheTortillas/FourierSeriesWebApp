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

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(generalLimiter);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/cache", cacheRouter);

  app.use("/api/fourier", computeLimiter, fourierRouter);
  app.use("/api/simplify", computeLimiter, simplifyRouter);
  app.use("/api/transforms", computeLimiter, transformsRouter);
  app.use("/api/dft", dftRouter);
  app.use("/api/auth", authRouter);

  app.use(errorHandler);

  return app;
}
