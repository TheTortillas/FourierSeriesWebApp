import { createApp } from "./app";
import { MaximaRunner } from "./infrastructure/maxima/maximaRunner";

const PORT = process.env.PORT ?? 3000;
const app = createApp();
const runner = new MaximaRunner();

async function main() {
  const result = await runner.run({
    script: "string(integrate(x^2, x));",
  });
  console.log("Maxima test result:", result);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
