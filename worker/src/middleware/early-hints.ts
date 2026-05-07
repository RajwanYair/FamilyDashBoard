/**
 * FamilyDashBoard Worker — Early Hints middleware ( , Roadmap #7)
 *
 * Adds RFC 8297 `Link` preload headers to GET responses so that
 * Cloudflare's edge layer can synthesize a `103 Early Hints` response
 * before the JSON body arrives for browsers that support it.
 *
 * The six highest-priority API fetches the dashboard makes on page load
 * are listed in DASHBOARD_PRELOADS.  These are sent as `rel=preload; as=fetch`
 * hints so the browser can open connections / warm DNS in parallel.
 *
 * Usage in Hono:
 *   import { earlyHintsMiddleware } from "./middleware/early-hints";
 *   app.get("/health", earlyHintsMiddleware, handler);
 *
 * Reference: https://developers.cloudflare.com/workers/runtime-apis/response/
 *            RFC 8297 — "An HTTP Status Code for Indicating Hints"
 */

import type { MiddlewareHandler } from "hono";

/** Six highest-priority API fetches issued by the dashboard on first load. */
const DASHBOARD_PRELOADS: ReadonlyArray<{ href: string; as: string }> = [
  { href: "/api/weather", as: "fetch" },
  { href: "/api/currency", as: "fetch" },
  { href: "/api/hebcal", as: "fetch" },
  { href: "/api/news/aggregate", as: "fetch" },
  { href: "/api/crypto", as: "fetch" },
  { href: "/api/alerts", as: "fetch" },
];

/**
 * Builds the `Link` header value listing all dashboard preload hints.
 * Each entry is `</api/X>; rel=preload; as=fetch; crossorigin`.
 */
export function buildEarlyHintsLinkHeader(): string {
  return DASHBOARD_PRELOADS.map(
    ({ href, as }) => `<${href}>; rel=preload; as=${as}; crossorigin`,
  ).join(", ");
}

/**
 * Hono middleware: append `Link` preload headers on successful GET responses.
 * Cloudflare CDN edge reads these and emits a 103 Early Hints response to
 * HTTP/2 + HTTP/3 clients before the 200 body is forwarded.
 */
export const earlyHintsMiddleware: MiddlewareHandler = async (c, next) => {
  await next();
  if (c.req.method === "GET" && c.res.status < 400) {
    c.res.headers.append("Link", buildEarlyHintsLinkHeader());
  }
};
