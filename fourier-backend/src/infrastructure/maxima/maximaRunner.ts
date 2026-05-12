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
    const runOnce = (script: string, timeoutMs: number) =>
      new Promise<MaximaResult>((resolve) => {
        const startTime = Date.now();
        let stdout = "";
        let stderr = "";
        let settled = false;

        const isInteractivePrompt = (line: string): boolean => {
          const trimmed = line.trim();
          return [
            /^Is\b.*\?$/i,
            /^Continue\?$/i,
            /^Break\s+\d+\?$/i,
            /^Do you want.*\?$/i,
            /^Enter\b.*$/i,
          ].some((pattern) => pattern.test(trimmed));
        };

        const finish = (result: MaximaResult) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        const detectPrompt = (chunk: string): string | null => {
          const lines = chunk.split(/\r?\n/);
          return lines.find(isInteractivePrompt) ?? null;
        };

        const process = spawn("maxima", ["--very-quiet"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        const timeout = setTimeout(() => {
          process.kill();
          finish({
            raw: "",
            success: false,
            error: `Timeout after ${timeoutMs}ms`,
            executionTimeMs: Date.now() - startTime,
          });
        }, timeoutMs);

        process.stdout.on("data", (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;

          const promptLine = detectPrompt(chunk) ?? detectPrompt(stdout);
          if (promptLine) {
            console.error(`[MaximaRunner] interactive prompt: ${promptLine}`);
            process.kill();
            finish({
              raw: stdout.trim(),
              success: false,
              error: `Maxima requested interactive input: ${promptLine}`,
              executionTimeMs: Date.now() - startTime,
            });
          }
        });

        process.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        process.on("close", (code) => {
          // console.log("PROCESS CLOSE CODE:", code);
          // console.log("STDERR:", stderr.slice(0, 500));
          clearTimeout(timeout);
          if (settled) return;
          const raw = stdout.trim();

          if (code !== 0 || stderr.includes("Error")) {
            finish({
              raw,
              success: false,
              error: stderr.trim() || `Maxima exited with code ${code}`,
              executionTimeMs: Date.now() - startTime,
            });
            return;
          }

          finish({
            raw,
            success: true,
            executionTimeMs: Date.now() - startTime,
          });
        });

        process.stdin.write(script + "\nquit()$\n");
        process.stdin.end();
      });

    const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return runOnce(input.script, timeoutMs);
  }
}
