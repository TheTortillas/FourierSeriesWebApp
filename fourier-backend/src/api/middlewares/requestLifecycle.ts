import type { Request, Response } from "express";

export interface ClientConnectionGuard {
  isDisconnected(): boolean;
}

/**
 * Tracks whether the HTTP client disconnected before the handler finished.
 * Use this to skip side effects (quota/history) for aborted requests.
 */
export function trackClientConnection(
  req: Request,
  res: Response,
): ClientConnectionGuard {
  let disconnected = false;

  req.once("aborted", () => {
    disconnected = true;
  });

  req.once("close", () => {
    if (req.aborted) disconnected = true;
  });

  res.once("close", () => {
    // close before writable end means the response never fully reached client
    if (!res.writableEnded) disconnected = true;
  });

  return {
    isDisconnected: () => disconnected,
  };
}
