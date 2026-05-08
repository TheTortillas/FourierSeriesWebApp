import { spawn } from "child_process";
import type { IMaximaRunner } from "../../domain/interfaces/IMaximaRunner";
import type {
  MaximaInput,
  MaximaResult,
} from "../../domain/types/maxima.types";
import { config } from "../../config/env";

const DEFAULT_TIMEOUT_MS = config.maxima.timeoutMs;

export class MaximaRunner implements IMaximaRunner {
  run(input: MaximaInput): Promise<MaximaResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      let stdout = "";
      let stderr = "";

      const process = spawn("maxima", ["--very-quiet"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        process.kill();
        resolve({
          raw: "",
          success: false,
          error: `Timeout after ${timeoutMs}ms`,
          executionTimeMs: Date.now() - startTime,
        });
      }, timeoutMs);

      process.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      process.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        // console.log("PROCESS CLOSE CODE:", code);
        // console.log("STDERR:", stderr.slice(0, 500));
        clearTimeout(timeout);
        const raw = stdout.trim();

        if (code !== 0 || stderr.includes("Error")) {
          resolve({
            raw,
            success: false,
            error: stderr.trim() || `Maxima exited with code ${code}`,
            executionTimeMs: Date.now() - startTime,
          });
          return;
        }

        resolve({
          raw,
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      });

      process.stdin.write(input.script + "\nquit()$\n");
      process.stdin.end();
    });
  }
}
