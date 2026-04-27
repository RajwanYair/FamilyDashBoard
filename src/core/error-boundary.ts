/**
 * FamilyDashBoard — Card Error Boundary
 *
 * `withErrorBoundary()` wraps any card init or loader function and:
 *   1. Catches synchronous and asynchronous errors
 *   2. Renders a standard `.card-error` element in the card body
 *   3. Logs the failure via `diagLog` for the diagnostic overlay
 *   4. Records the error in the runtime error buffer (reportable via /api/errors)
 *
 * Usage:
 *   const safeInit = withErrorBoundary("weather", initWeatherCard);
 *   safeInit(); // never throws
 */

import { diagLog } from "./diag";
import { recordError } from "./error-tracker";

/**
 * Wrap `fn` with an error boundary for the named card.
 *
 * Returns an async function that:
 * - Runs `fn()` and resolves with its return value on success.
 * - On failure: logs, renders error UI, and resolves with `undefined`.
 *   Never rejects, never throws.
 */
export function withErrorBoundary<T>(
  cardId: string,
  fn: () => T | Promise<T>,
): () => Promise<T | undefined> {
  return async function bounded(): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      diagLog(`[error-boundary] "${cardId}" threw: ${msg}`);
      recordError(msg, `card:${cardId}`);

      _renderCardError(cardId, msg);
      return undefined;
    }
  };
}

/**
 * Render a standard error tile in the named card's body.
 * No-op if the card element or body cannot be found.
 * Idempotent — won't add a second error if one is already displayed.
 */
function _renderCardError(cardId: string, message: string): void {
  const body = document.querySelector<HTMLElement>(`[data-card-id="${cardId}"] .card__body`);
  if (!body) return;
  // Avoid duplicate error tiles
  if (body.querySelector(".card-error")) return;

  const div = document.createElement("div");
  div.className = "card-error";
  div.setAttribute("role", "alert");
  div.textContent = `שגיאה בטעינה · ${message}`;
  body.appendChild(div);
}
