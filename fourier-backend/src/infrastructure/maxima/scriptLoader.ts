import fs from "fs/promises";
import path from "path";

const SCRIPTS_BASE = path.resolve("src/scripts/maxima");

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
