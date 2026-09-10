import { cGet, cGetStale, cSet } from "./cache";
import {
  getProviderHealth,
  recordProviderFailure,
  recordProviderSuccess,
  type ProviderFailureStage,
} from "./provider";
import { diagLog } from "./diag";
import { notifyProviderBlocked } from "./provider-toast";
import { getLastFetchStage } from "./fetch";
import type { ProviderAdapter, ProviderResult } from "../types/provider";

interface CachedProviderAdapterOptions<T> {
  id: string;
  displayName: string;
  cacheKey: string;
  cacheTtl: number;
  fetchFresh: () => Promise<T>;
  successLog?: (data: T) => string;
  failureLog?: (message: string) => string;
  failureMessage?: (message: string) => string;
  failureStage?: (error: unknown) => ProviderFailureStage | undefined;
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
    failureStage,
  } = options;

  return {
    id,
    displayName,
    cacheKey,
    cacheTtl,

    async fetch(): Promise<ProviderResult<T>> {
      const cached = cGet<T>(cacheKey, cacheTtl);
      if (cached !== null) {
        return { ok: true, data: cached };
      }

      let fetched = false;
      try {
        const data = await fetchFresh();
        fetched = true;
        cSet(cacheKey, data);
        recordProviderSuccess(id);
        if (successLog) {
          diagLog(successLog(data));
        }
        return { ok: true, data };
      } catch (err) {
        const stage = fetched ? "cache" : (failureStage?.(err) ?? getLastFetchStage());
        if (stage === "unknown") recordProviderFailure(id);
        else recordProviderFailure(id, stage);
        const stale = cGetStale<T>(cacheKey);
        const message = err instanceof Error ? err.message : String(err);
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
