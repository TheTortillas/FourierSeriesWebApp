import { createApp } from "./app";
import { config } from "./config/env";
import { checkDbConnection } from "./infrastructure/database/db";
import { logger } from "./infrastructure/logging/logger";
import { startAutoBlocker } from "./infrastructure/jobs/autoBlocker";

async function main() {
  await checkDbConnection();

  // Arrancar el worker de auto-bloqueo de IPs.
  // Se hace aquí (post checkDbConnection) para garantizar que la DB
  // está disponible antes de la primera ejecución del worker.
  startAutoBlocker();

  const app = createApp();
  app.listen(config.server.port, () => {
    logger.info(
      { port: config.server.port, env: config.server.nodeEnv },
      "Server started",
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
