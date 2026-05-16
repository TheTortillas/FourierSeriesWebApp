import { LRUCache } from "lru-cache";
import Redis from "ioredis";
import type {
  FourierResult,
  HalfRangeResult,
  ComplexFourierResult,
  PiecewiseFourierInput,
} from "../../domain/types/fourier.types";
import { config } from "../../config/env";

// ── Types ─────────────────────────────────────────────────────────────────────

type CacheValue = FourierResult | HalfRangeResult | ComplexFourierResult;

export interface CacheStats {
  backend: "redis" | "lru";
  connected: boolean;
  size: number;
  /** Max entries for LRU, -1 for Redis (unbounded by entry count). */
  max: number;
  ttlDays: number;
  version: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Bump this whenever the Maxima scripts change to invalidate stale entries. */
const CACHE_VERSION = "6";

const KEY_PREFIX = `fourier:v${CACHE_VERSION}`;
const TTL_SECONDS = config.cache.ttlDays * 86_400;

// ── LRU fallback (always present) ─────────────────────────────────────────────

const lru = new LRUCache<string, CacheValue>({
  max: config.cache.maxSize,
});

// ── Redis (optional) ──────────────────────────────────────────────────────────

let redis: Redis | null = null;
let redisReady = false;

if (config.redis.enabled) {
  redis = new Redis(config.redis.url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 3_000,
    commandTimeout: 2_000,
  });

  redis.on("ready", () => {
    redisReady = true;
  });
  redis.on("close", () => {
    redisReady = false;
  });
  redis.on("error", () => {
    redisReady = false;
  });

  // Connect asynchronously on startup; failures are non-fatal.
  redis.connect().catch(() => {
    // Logged via the error event; we fall through to LRU silently.
  });
}

// ── Key builder ───────────────────────────────────────────────────────────────

export function buildCacheKey(input: PiecewiseFourierInput): string {
  const segments = input.segments
    .map((s) => `${s.expression}|${s.from}|${s.to}`)
    .join("::");
  return `${KEY_PREFIX}::${input.seriesType}::${input.intVar ?? "x"}::${segments}`;
}

// ── Public async API ──────────────────────────────────────────────────────────

export async function getFromCache(
  key: string,
): Promise<CacheValue | undefined> {
  if (redisReady && redis) {
    try {
      const raw = await redis.get(key);
      if (raw !== null) return JSON.parse(raw) as CacheValue;
      return undefined;
    } catch {
      // Fall through to LRU on transient Redis error.
    }
  }
  return lru.get(key);
}

export async function setInCache(
  key: string,
  value: CacheValue,
): Promise<void> {
  if (redisReady && redis) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
      return;
    } catch {
      // Fall through to LRU on transient Redis error.
    }
  }
  lru.set(key, value);
}

export async function getCacheStats(): Promise<CacheStats> {
  if (redisReady && redis) {
    try {
      const keyCount = await redis.dbsize();
      return {
        backend: "redis",
        connected: true,
        size: keyCount,
        max: -1,
        ttlDays: config.cache.ttlDays,
        version: CACHE_VERSION,
      };
    } catch {
      // Fall through to LRU stats on transient error.
    }
  }
  return {
    backend: "lru",
    connected: config.redis.enabled ? false : true,
    size: lru.size,
    max: config.cache.maxSize,
    ttlDays: 0,
    version: CACHE_VERSION,
  };
}

export async function clearCache(): Promise<void> {
  if (redisReady && redis) {
    try {
      // Only delete keys belonging to this app (prefix scan).
      const keys = await redis.keys(`${KEY_PREFIX}*`);
      if (keys.length > 0) await redis.del(...keys);
      return;
    } catch {
      // Fall through to LRU clear on transient error.
    }
  }
  lru.clear();
}
