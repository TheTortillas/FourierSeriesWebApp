import { Router, Request, Response } from "express";
import { db } from "../../infrastructure/database/db";
import { getCacheStats } from "../../infrastructure/cache/fourierCache";
import { config } from "../../config/env";

export const healthRouter = Router();

type ComponentStatus = "ok" | "degraded";

interface HealthResponse {
  status: ComponentStatus;
  environment: string;
  uptime: number;
  timestamp: string;
  components: {
    database: { status: ComponentStatus; latencyMs?: number; error?: string };
    cache: { status: ComponentStatus; size: number; max: number };
  };
}

/** Runs a lightweight SELECT 1 against the pool and returns latency in ms. */
async function checkDatabase(): Promise<
  HealthResponse["components"]["database"]
> {
  const start = Date.now();
  try {
    const client = await db.connect();
    await client.query("SELECT 1");
    client.release();
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "degraded",
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: >
 *       Returns the operational status of the API and its dependencies.
 *       Responds with 200 when all components are healthy, 503 when any
 *       component is degraded. Suitable for use with uptime monitors.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: All components operational
 *       503:
 *         description: One or more components degraded
 */
healthRouter.get("/", async (_req: Request, res: Response): Promise<void> => {
  const [database] = await Promise.all([checkDatabase()]);

  const cacheStats = getCacheStats();
  const cache: HealthResponse["components"]["cache"] = {
    status: "ok",
    ...cacheStats,
  };

  const overallStatus: ComponentStatus =
    database.status === "ok" ? "ok" : "degraded";

  const body: HealthResponse = {
    status: overallStatus,
    environment: config.server.nodeEnv,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    components: { database, cache },
  };

  res.status(overallStatus === "ok" ? 200 : 503).json(body);
});
