import fs from "fs/promises";
import path from "path";
import { config } from "../../config/env";

const SCRIPTS_BASE = path.resolve(config.maxima.scriptsPath);

export async function loadScript(
  category: string,
  scriptName: string,
): Promise<string> {
  const scriptPath = path.join(SCRIPTS_BASE, category, scriptName);
  try {
    return await fs.readFile(scriptPath, "utf-8");
  } catch {
    throw new Error(`Script not found: ${category}/${scriptName}`);
  }
}
