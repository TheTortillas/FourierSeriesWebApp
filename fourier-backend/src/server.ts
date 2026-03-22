import { createApp } from "./app";
import { config } from "./config/env";
import { checkDbConnection } from "./infrastructure/database/db";

async function main() {
  await checkDbConnection();

  const app = createApp();
  app.listen(config.server.port, () => {
    console.log(
      `Server running on port ${config.server.port} [${config.server.nodeEnv}]`,
    );
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
