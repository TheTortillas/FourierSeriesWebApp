import { LRUCache } from "lru-cache";
import type {
  FourierResult,
  HalfRangeResult,
  ComplexFourierResult,
  PiecewiseFourierInput,
} from "../../domain/types/fourier.types";

type CacheValue = FourierResult | HalfRangeResult | ComplexFourierResult;

const cache = new LRUCache<string, CacheValue>({
  max: 500,
});

export function buildCacheKey(input: PiecewiseFourierInput): string {
  const segments = input.segments
    .map((s) => `${s.expression}|${s.from}|${s.to}`)
    .join("::");
  return `${input.seriesType}::${input.intVar ?? "x"}::${segments}`;
}

export function getFromCache(key: string): CacheValue | undefined {
  return cache.get(key);
}

export function setInCache(key: string, value: CacheValue): void {
  cache.set(key, value);
}

export function getCacheStats(): { size: number; max: number } {
  return { size: cache.size, max: 500 };
}

export function clearCache(): void {
  cache.clear();
}
