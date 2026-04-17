/**
 * FamilyDashBoard v6 — Fetch Helpers
 *
 * fetchWithTimeout: AbortController-based timeout wrapper.
 * fetchJSON: fetch with CORS proxy fallback chain + diagnostic logging.
 * fetchJSONDeduped: deduplicates concurrent requests for the same URL.
 * raceProxies: Promise.any() across all proxies for fastest response.
 * runConcurrent: CPU-aware task pool limiter.
 */

import {
  PROXIES,
  FETCH_TIMEOUT_MS,
  MAX_CONCURRENT,
  WORKER_BASE_URL,
  isWorkerEnabled,
} from "./constants";
import { diagLog } from "./diag";

/**
 * Fetch with AbortController timeout.
 */
export async function fetchWithTimeout(
  url: string,
  ms: number = FETCH_TIMEOUT_MS,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch JSON through CORS proxy chain.
 * Tries direct first, then each proxy in order.
 */
export async function fetchJSON<T = unknown>(url: string): Promise<T> {
  const short = url.length > 60 ? url.slice(0, 57) + "..." : url;

  // 1. Try direct
  try {
    const r = await fetchWithTimeout(url);
    if (r.ok) {
      diagLog(`FDB-011: fetchJSON direct OK: ${short}`);
      recordFetchSuccess();
      return (await r.json()) as T;
    }
  } catch {
    // Direct failed — try proxies
  }

  // 2. Try each proxy
  const customProxy = localStorage.getItem("dash_custom_proxy");
  const proxies = customProxy ? [customProxy, ...PROXIES] : [...PROXIES];

  for (const p of proxies) {
    const pName = p.includes("allorigins")
      ? "allorigins"
      : p.includes("codetabs")
        ? "codetabs"
        : p.includes("corsproxy")
          ? "corsproxy"
          : "custom";

    try {
      const proxyUrl = p + encodeURIComponent(url);
      const r = await fetchWithTimeout(proxyUrl, 12_000);
      if (!r.ok) {
        diagLog(`FDB-012: fetchJSON ${pName} HTTP ${r.status}: ${short}`);
        continue;
      }

      if (p.includes("allorigins")) {
        const wrapper = (await r.json()) as { contents: string };
        diagLog(`FDB-013: fetchJSON ${pName} OK: ${short}`);
        recordFetchSuccess();
        return JSON.parse(wrapper.contents) as T;
      }

      diagLog(`FDB-013: fetchJSON ${pName} OK: ${short}`);
      recordFetchSuccess();
      return (await r.json()) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      diagLog(`FDB-014: fetchJSON ${pName} FAIL (${msg.slice(0, 60)}): ${short}`);
    }
  }

  recordFetchFailure();
  throw new Error(`All proxies failed for: ${short}`);
}

/**
 * Fetch JSON via the Cloudflare Worker proxy.
 * The worker accepts: GET /proxy?url=<encoded>
 * Returns the original API's JSON (worker unwraps CORS).
 *
 * @returns The parsed JSON or null if the worker is unavailable.
 */
export async function fetchViaWorker<T = unknown>(url: string): Promise<T | null> {
  if (!isWorkerEnabled()) return null;
  const workerUrl = `${WORKER_BASE_URL}/proxy?url=${encodeURIComponent(url)}`;
  const short = url.length > 60 ? url.slice(0, 57) + "..." : url;
  try {
    const r = await fetchWithTimeout(workerUrl, FETCH_TIMEOUT_MS);
    if (!r.ok) {
      diagLog(`FDB-015: fetchViaWorker HTTP ${r.status}: ${short}`);
      return null;
    }
    diagLog(`FDB-016: fetchViaWorker OK: ${short}`);
    return (await r.json()) as T;
  } catch {
    diagLog(`FDB-017: fetchViaWorker FAIL: ${short}`);
    return null;
  }
}

/**
 * Fetch JSON — worker-first, then direct/proxy fallback.
 * Drop-in replacement for fetchJSON() in worker-aware cards.
 */
export async function fetchJSONWithWorker<T = unknown>(url: string): Promise<T> {
  const workerResult = await fetchViaWorker<T>(url);
  if (workerResult !== null) return workerResult;
  return fetchJSON<T>(url);
}

// ── Request deduplication ─────────────────────────────────────────────────────

/**
 * Map of in-flight requests keyed by URL.
 * Multiple callers asking for the same URL while one is pending
 * will all await the same Promise instead of launching duplicate HTTP requests.
 */
const _inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Deduplicated fetchJSON: if a request for `url` is already in-flight,
 * returns the existing Promise instead of starting a new one.
 *
 * Use this on any loader that might be called concurrently (e.g., on
 * page-restore + setInterval firing at the same time).
 */
export async function fetchJSONDeduped<T = unknown>(url: string): Promise<T> {
  const existing = _inflightRequests.get(url);
  if (existing !== undefined) {
      diagLog(`FDB-018: [fetch] dedup reuse: ${url.slice(0, 60)}`);
    return existing as Promise<T>;
  }
  const p = fetchJSON<T>(url).finally(() => {
    _inflightRequests.delete(url);
  });
  _inflightRequests.set(url, p as Promise<unknown>);
  return p;
}

/** Returns the number of currently in-flight deduplicated requests. */
export function getInflightCount(): number {
  return _inflightRequests.size;
}

/**
 * Race all proxies via Promise.any() for fastest response.
 * Used by stock loader for lowest latency.
 */
export async function raceProxies(
  url: string,
  timeout: number = 5_000,
): Promise<Response> {
  const attempts = PROXIES.map((p) => {
    const proxyUrl = p + encodeURIComponent(url);
    return fetchWithTimeout(proxyUrl, timeout);
  });

  // Also try direct
  attempts.unshift(fetchWithTimeout(url, timeout));

  return Promise.any(attempts);
}

/**
 * Run tasks with CPU-aware concurrency limit.
 */
export async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  limit: number = MAX_CONCURRENT,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p = task()
      .then((value) => {
        results.push({ status: "fulfilled", value });
      })
      .catch((reason: unknown) => {
        results.push({ status: "rejected", reason });
      })
      .finally(() => {
        executing.delete(p);
      });

    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.allSettled([...executing]);
  return results;
}

// ── Fetch lock (prevent duplicate concurrent requests per pane) ──
const fetchLocks = new Set<string>();

export function acquireLock(name: string): boolean {
  if (fetchLocks.has(name)) return false;
  fetchLocks.add(name);
  return true;
}

export function releaseLock(name: string): void {
  fetchLocks.delete(name);
}

/** Clear all fetch locks (useful in tests or on page unload). */
export function clearFetchLocks(): void {
  fetchLocks.clear();
}

// ── Network quality tier ──────────────────────────────────────────────────────

export type NetworkQualityTier = "ok" | "slow" | "bad" | "unknown";

/**
 * Returns a rough network quality tier based on the Network Information API
 * (`navigator.connection`) when available, or falls back to the consecutive
 * failure streak tracked by `recordFetchFailure`.
 */
export function getNetworkQualityTier(): NetworkQualityTier {
  if (_consecutiveFailures >= 3) return "bad";
  if (_consecutiveFailures >= 1) return "slow";

  // Use Network Information API when available (Chrome/Android)
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const conn = nav.connection;
  if (conn) {
    const etype = conn.effectiveType ?? "";
    if (etype === "4g" || (conn.downlink !== undefined && conn.downlink > 1)) return "ok";
    if (etype === "3g" || etype === "2g") return "slow";
    if (etype === "slow-2g") return "bad";
    if (conn.rtt !== undefined) {
      if (conn.rtt < 150) return "ok";
      if (conn.rtt < 600) return "slow";
      return "bad";
    }
  }

  return _consecutiveFailures === 0 ? "ok" : "unknown";
}

// ── Network failure tracking ──────────────────────────────────────────────────
/** Number of consecutive proxy-chain failures across all cards. */
let _consecutiveFailures = 0;
/** Whether the last attempt ended in network-wide failure. */
let _networkOffline = false;

/** Record a successful fetch (resets failure streak). */
export function recordFetchSuccess(): void {
  if (_networkOffline) {
    diagLog("[network] connectivity restored");
  }
  _consecutiveFailures = 0;
  _networkOffline = false;
}

/** Record a failed fetch (increments streak; logs degraded/offline transitions). */
export function recordFetchFailure(): void {
  _consecutiveFailures += 1;
  if (_consecutiveFailures === 3) {
    _networkOffline = true;
    diagLog("[network] 3+ consecutive failures — degraded mode");
  }
}

/** Returns true when 3+ consecutive failures have been seen. */
export function isNetworkOffline(): boolean {
  return _networkOffline;
}

/** Returns the current consecutive-failure count. */
export function getConsecutiveFailures(): number {
  return _consecutiveFailures;
}

/**
 * Fetch JSON with exponential backoff retries.
 *
 * On transient failures (network error or 5xx), retry up to `maxAttempts`
 * times with a doubling delay starting at `baseDelayMs`.
 *
 * @param url         The URL to fetch (proxied via fetchJSON).
 * @param maxAttempts Total attempts including the first (default 3).
 * @param baseDelayMs Initial retry delay in ms (doubles each retry).
 */
export async function fetchWithRetry<T = unknown>(
  url: string,
  maxAttempts = 3,
  baseDelayMs = 1_000,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fetchJSON<T>(url);
      // fetchJSON already calls recordFetchSuccess on proxy success,
      // but ensure it's called here too in case of direct success path.
      return result;
    } catch (err) {
      lastErr = err;
      recordFetchFailure();
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        diagLog(`fetchWithRetry attempt ${attempt}/${maxAttempts} failed, retry in ${delay}ms`);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastErr;
}

/**
 * Fetch with automatic stale-cache fallback.
 *
 * Pattern:
 *   1. Check fresh cache → return immediately if hit.
 *   2. Return stale cache immediately (optimistic display) while re-fetching.
 *   3. Fetch fresh data and update cache + render.
 *   4. On fetch failure, the stale data (or staticFallback) is already shown.
 *
 * @param cacheKey      localStorage cache key (without prefix)
 * @param ttlMs         Cache TTL in milliseconds
 * @param fetcher       Async function that returns fresh data
 * @param onData        Callback called with fresh/stale/fallback data
 * @param staticFallback Optional static value shown when both cache and network fail
 */
export async function fetchWithStale<T>(opts: {
  cacheKey: string;
  ttlMs: number;
  fetcher: () => Promise<T>;
  onData: (data: T, isStale: boolean) => void;
  staticFallback?: T;
}): Promise<void> {
  const { cacheKey, ttlMs, fetcher, onData, staticFallback } = opts;
  const fresh = (await import("./cache")).cGet<T>(cacheKey, ttlMs);
  if (fresh !== null) {
    onData(fresh, false);
    return;
  }
  const stale = (await import("./cache")).cGetStale<T>(cacheKey);
  if (stale !== null) onData(stale, true);
  else if (staticFallback !== undefined) onData(staticFallback, true);

  try {
    const data = await fetcher();
    (await import("./cache")).cSet(cacheKey, data);
    onData(data, false);
  } catch {
    diagLog(`[fetch] fetchWithStale miss: ${cacheKey}`);
    if (stale === null && staticFallback !== undefined)
      onData(staticFallback, true);
  }
}
