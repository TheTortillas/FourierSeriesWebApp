import express, { Application } from "express";
import cors from "cors";
import { fourierRouter } from "./api/routes/fourier.routes";
import { dftRouter } from "./api/routes/dft.routes";
import { errorHandler } from "./api/middlewares/errorHandler";

export function createApp(): Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/fourier", fourierRouter);
  app.use("/api/dft", dftRouter);

  app.use(errorHandler);

  return app;
}
