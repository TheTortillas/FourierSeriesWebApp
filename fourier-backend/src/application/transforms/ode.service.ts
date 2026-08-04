import { MaximaRunner } from "../../infrastructure/maxima/maximaRunner";
import { loadScript } from "../../infrastructure/maxima/scriptLoader";
import type { OdeInput, OdeResult, SymbolicExpression } from "../../domain/types/fourier.types";

export class OdeService {
  constructor(private readonly runner: MaximaRunner) {}

  async solve(input: OdeInput): Promise<OdeResult> {
    const startTime = Date.now();

    const x0   = input.x0   ?? "0";
    const y0   = input.y0   ?? "0";
    const dy0  = input.dy0  ?? "0";
    const ddy0 = input.ddy0 ?? "0";
    const x1   = input.x1   ?? "0";
    const y1  = input.y1  ?? "0";
    const x2  = input.x2  ?? "1";
    const y2  = input.y2  ?? "0";

    const script = await loadScript("transforms", "ode_solve.mac");
    const fullScript = `
ODE_Y: ${input.unknown}$
ODE_X: ${input.ivar}$
depends(ODE_Y, ODE_X)$
ODE_EQ:   ${input.equation};
ODE_MODE: "${input.mode}";
ODE_X0: ${x0}; ODE_Y0: ${y0}; ODE_DY0: ${dy0}; ODE_DDY0: ${ddy0};
ODE_X1: ${x1}; ODE_Y1: ${y1};
ODE_X2: ${x2}; ODE_Y2: ${y2};
${script}
kill(all)$
`.trim();

    const { raw } = await this.runner.run({ script: fullScript, timeoutMs: 60000 });

    const exists    = this.extractBetween(raw, "__EXISTS__",    "__SOL_MAXIMA__").trim().includes("true");
    const solMaxima = this.extractBetween(raw, "__SOL_MAXIMA__","__SOL_TEX__").trim();
    const solTex    = this.extractTex(this.extractBetween(raw, "__SOL_TEX__", "__PARAMS__"));
    const paramsRaw = this.extractBetween(raw, "__PARAMS__",    "__ORDER__").trim();
    const params    = this.parseParams(paramsRaw);
    const orderRaw  = this.extractBetween(raw, "__ORDER__",     "__METHOD__").trim();
    const method    = this.extractBetween(raw, "__METHOD__",    null).trim();

    return {
      input,
      exists,
      solution: this.toSymbolic(solMaxima, solTex),
      params:   params.length ? params : undefined,
      order:    orderRaw ? Number(orderRaw) : undefined,
      method:   method || undefined,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private parseParams(raw: string): string[] {
    const match = raw.match(/\[([^\]]*)\]/);
    if (!match) return [];
    return match[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }

  private toSymbolic(maxima: string, tex: string): SymbolicExpression | undefined {
    if (!maxima || maxima === "false") return undefined;
    return { maxima, tex };
  }

  private extractBetween(text: string, start: string, end: string | null): string {
    const startIdx = text.indexOf(start);
    if (startIdx === -1) return "";
    const afterStart = startIdx + start.length;
    if (end === null) return text.slice(afterStart);
    const endIdx = text.indexOf(end, afterStart);
    return endIdx === -1 ? text.slice(afterStart) : text.slice(afterStart, endIdx);
  }

  private extractTex(raw: string): string {
    const match = raw.match(/\$\$([\s\S]+?)\$\$/);
    return match ? match[1].trim() : "";
  }
}
