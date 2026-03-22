import { Pool } from "pg";
import { config } from "../../config/env";

export const db = new Pool({
  connectionString: config.database.url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

db.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

export async function checkDbConnection(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.log("Database connected successfully");
}
