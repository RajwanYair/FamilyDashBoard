/**
 * FamilyDashBoard v6 — Fetch Helpers
 *
 * fetchWithTimeout: AbortController-based timeout wrapper.
 * fetchJSON: fetch with CORS proxy fallback chain + diagnostic logging.
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
      diagLog(`fetchJSON direct OK: ${short}`);
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
      if (!r.ok) continue;

      if (p.includes("allorigins")) {
        const wrapper = (await r.json()) as { contents: string };
        diagLog(`fetchJSON ${pName} OK: ${short}`);
        recordFetchSuccess();
        return JSON.parse(wrapper.contents) as T;
      }

      diagLog(`fetchJSON ${pName} OK: ${short}`);
      recordFetchSuccess();
      return (await r.json()) as T;
    } catch {
      diagLog(`fetchJSON ${pName} FAIL: ${short}`);
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
      diagLog(`fetchViaWorker HTTP ${r.status}: ${short}`);
      return null;
    }
    diagLog(`fetchViaWorker OK: ${short}`);
    return (await r.json()) as T;
  } catch {
    diagLog(`fetchViaWorker FAIL: ${short}`);
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
      return await fetchJSON<T>(url);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        diagLog(`fetchWithRetry attempt ${attempt}/${maxAttempts} failed, retry in ${delay}ms`);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastErr;
}
