import { cGet, cGetStale, cSet } from "./cache";
import { getProviderHealth, recordProviderFailure, recordProviderSuccess } from "./provider";
import { diagLog } from "./diag";
import { notifyProviderBlocked } from "./provider-toast";
import type { ProviderFailureStage } from "./provider";
import type { ProviderAdapter, ProviderResult } from "../types/provider";

export class ProviderAdapterError extends Error {
  readonly stage: ProviderFailureStage;

  constructor(message: string, stage: ProviderFailureStage) {
    super(message);
    this.name = "ProviderAdapterError";
    this.stage = stage;
  }
}

interface CachedProviderAdapterOptions<T> {
  id: string;
  displayName: string;
  cacheKey: string;
  cacheTtl: number;
  fetchFresh: () => Promise<T>;
  successLog?: (data: T) => string;
  failureLog?: (message: string) => string;
  failureMessage?: (message: string) => string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readFreshCache<T>(cacheKey: string, cacheTtl: number): T | null {
  try {
    return cGet<T>(cacheKey, cacheTtl);
  } catch (error) {
    throw new ProviderAdapterError(`Cache read failed: ${errorMessage(error)}`, "cache");
  }
}

function writeFreshCache<T>(cacheKey: string, data: T): void {
  try {
    cSet(cacheKey, data);
  } catch (error) {
    throw new ProviderAdapterError(`Cache write failed: ${errorMessage(error)}`, "cache");
  }
}

function readStaleCache<T>(cacheKey: string): T | null {
  try {
    return cGetStale<T>(cacheKey);
  } catch (error) {
    diagLog(`[${cacheKey}] Stale cache read failed: ${errorMessage(error)}`);
    return null;
  }
}

export function createCachedProviderAdapter<T>(
  options: CachedProviderAdapterOptions<T>,
): ProviderAdapter<T> {
  const {
    id,
    displayName,
    cacheKey,
    cacheTtl,
    fetchFresh,
    successLog,
    failureLog,
    failureMessage,
  } = options;

  return {
    id,
    displayName,
    cacheKey,
    cacheTtl,

    async fetch(): Promise<ProviderResult<T>> {
      try {
        const cached = readFreshCache<T>(cacheKey, cacheTtl);
        if (cached !== null) {
          return { ok: true, data: cached };
        }

        const data = await fetchFresh();
        writeFreshCache(cacheKey, data);
        recordProviderSuccess(id);
        if (successLog) {
          diagLog(successLog(data));
        }
        return { ok: true, data };
      } catch (err) {
        const stage = err instanceof ProviderAdapterError ? err.stage : "unknown";
        recordProviderFailure(id, stage);
        const stale = readStaleCache<T>(cacheKey);
        const message = errorMessage(err);
        diagLog(failureLog ? failureLog(message) : `[${id}] ${message}`);
        // when health flips to "down" and
        // there is no stale fallback, surface a rate-limited toast so the user
        // knows the card is firewalled instead of just staring at a spinner.
        if (stale === null && getProviderHealth(id).status === "down") {
          notifyProviderBlocked(id, displayName);
        }
        return {
          ok: false,
          error: failureMessage ? failureMessage(message) : message,
          stale: stale ?? undefined,
        };
      }
    },

    status() {
      return getProviderHealth(id).status;
    },
  };
}
