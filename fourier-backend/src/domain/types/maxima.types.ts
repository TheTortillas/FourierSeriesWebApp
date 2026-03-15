export interface MaximaResult {
  raw: string;
  success: boolean;
  error?: string;
  executionTimeMs: number;
}

export interface MaximaInput {
  script: string;
  timeoutMs?: number;
}
