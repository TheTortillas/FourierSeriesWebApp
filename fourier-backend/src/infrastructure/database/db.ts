import { Pool } from "pg";
import { config } from "../../config/env";
import { logger } from "../logging/logger";

export const db = new Pool({
  connectionString: config.database.url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error");
});

export async function checkDbConnection(): Promise<void> {
  const client = await db.connect();
  client.release();
  logger.info("Database connected successfully");
}
