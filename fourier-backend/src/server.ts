import { createApp } from "./app";
import { postProcessor } from "./infrastructure/container";
import type { FourierResult } from "./domain/types/fourier.types";

const PORT = process.env.PORT ?? 3000;
const app = createApp();

async function main() {
  const fakeResult: FourierResult = {
    input: { func: "test", period: 2, seriesType: "trigonometric" },
    coefficients: {
      an: "-(%i*gamma_incomplete(0,%i*x) - %i*gamma_incomplete(0,-(%i*x)))/2",
    },
    series: "",
    executionTimeMs: 0,
  };

  if (postProcessor.canProcess(fakeResult.coefficients.an ?? "")) {
    const processed = await postProcessor.process(fakeResult);
    console.log("Post-processed result:", JSON.stringify(processed, null, 2));
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

main();
