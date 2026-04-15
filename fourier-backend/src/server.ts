import { createApp } from "./app";
import { config } from "./config/env";
import { checkDbConnection } from "./infrastructure/database/db";
import { logger } from "./infrastructure/logging/logger";

async function main() {
  await checkDbConnection();

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
