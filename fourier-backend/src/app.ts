import express, { Application } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./api/swagger";
import { fourierRouter } from "./api/routes/fourier.routes";
import { dftRouter } from "./api/routes/dft.routes";
import { simplifyRouter } from "./api/routes/simplify.routes";
import { errorHandler } from "./api/middlewares/errorHandler";

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use("/api/fourier", fourierRouter);
  app.use("/api/dft", dftRouter);
  app.use("/api/simplify", simplifyRouter);

  app.use(errorHandler);

  return app;
}
