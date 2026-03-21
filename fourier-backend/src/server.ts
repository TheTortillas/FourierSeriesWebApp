import { createApp } from "./app";
import { config } from "./config/env";

const PORT = process.env.PORT ?? 3000;
const app = createApp();

app.listen(config.server.port, () => {
  console.log(
    `Server running on port ${config.server.port} [${config.server.nodeEnv}]`,
  );
});
