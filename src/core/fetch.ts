/**
 * FamilyDashBoard v6 — Fetch Helpers
 *
 * fetchWithTimeout: AbortController-based timeout wrapper.
 * fetchJSON: fetch with CORS proxy fallback chain + diagnostic logging.
 * raceProxies: Promise.any() across all proxies for fastest response.
 * runConcurrent: CPU-aware task pool limiter.
 */

import { PROXIES, FETCH_TIMEOUT_MS, MAX_CONCURRENT } from "./constants";
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
        return JSON.parse(wrapper.contents) as T;
      }

      diagLog(`fetchJSON ${pName} OK: ${short}`);
      return (await r.json()) as T;
    } catch {
      diagLog(`fetchJSON ${pName} FAIL: ${short}`);
    }
  }

  throw new Error(`All proxies failed for: ${short}`);
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
