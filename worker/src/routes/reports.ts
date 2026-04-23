/**
 * FamilyDashBoard Worker — POST /api/reports + GET /api/reports/digest (V12-OPS)
 *
 * Implements the browser Reporting API endpoint (https://www.w3.org/TR/reporting-1/).
 * Browsers configured to send CSP violation reports, deprecation notices, and
 * intervention reports POST structured data here.
 *
 * POST /api/reports
 *   - Accepts: application/reports+json or application/json
 *   - Body: array of report objects (browser-generated, validated with Valibot)
 *   - Returns: 204 No Content on success (or on non-fatal failure — fire-and-forget)
 *   - No auth required — browsers send these automatically
 *   - Rate-limited by the shared middleware
 *
 * GET /api/reports/digest
 *   - Requires: Authorization: Bearer <REPORTS_TOKEN>
 *   - Returns: JSON summary of report counts grouped by type × day (last 30 days)
 *   - Returns 501 when REPORTS_TOKEN or DB is not configured
 *   - Returns 401 on invalid/missing token
 *
 * See ADR-028.
 */

import * as v from "valibot";
import { storeReport, queryReportSummary } from "../utils/d1-reports";
import { CORS_HEADERS } from "../utils/response";
import type { Env } from "../types";

// ── Valibot schema ────────────────────────────────────────────────────────────

const ReportBodySchema = v.looseObject({
  documentURL: v.optional(v.string()),
  blockedURL: v.optional(v.string()),
  effectiveDirective: v.optional(v.string()),
  statusCode: v.optional(v.number()),
  message: v.optional(v.string()),
  id: v.optional(v.string()),
  anticipatedRemoval: v.optional(v.string()),
  sourceFile: v.optional(v.string()),
  lineNumber: v.optional(v.number()),
});

const ReportItemSchema = v.looseObject({
  type: v.string(),
  url: v.optional(v.string()),
  body: v.optional(ReportBodySchema),
});

const ReportsPayloadSchema = v.array(ReportItemSchema);

/** Maximum number of reports accepted per POST (prevents oversized payloads). */
const MAX_REPORTS_PER_REQUEST = 50;

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /api/reports — receive browser-generated reports.
 * Always returns 204 (or 400 on bad JSON/wrong shape). Never surfaces D1 errors.
 */
export async function handleReportsIngest(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request: invalid JSON\n", {
      status: 400,
      headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
    });
  }

  const parsed = v.safeParse(ReportsPayloadSchema, body);
  if (!parsed.success) {
    return new Response("Bad Request: expected an array of report objects\n", {
      status: 400,
      headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
    });
  }

  // Only process if D1 is configured; otherwise silently drop (feature is optional)
  if (env.DB) {
    const reports = parsed.output.slice(0, MAX_REPORTS_PER_REQUEST);
    for (const report of reports) {
      void storeReport(
        env.DB,
        report.type,
        report.url ?? "",
        (report.body as Record<string, unknown> | undefined) ?? {},
      );
    }
  }

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/reports/digest — token-gated summary of stored reports.
 */
export async function handleReportsDigest(req: Request, env: Env): Promise<Response> {
  // 501 when the feature is not provisioned
  if (!env.REPORTS_TOKEN || !env.DB) {
    return new Response(
      JSON.stringify({ error: "Reporting digest not configured" }),
      {
        status: 501,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      },
    );
  }

  // Token gate
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== env.REPORTS_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const summary = await queryReportSummary(env.DB);

  return new Response(
    JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    },
  );
}
