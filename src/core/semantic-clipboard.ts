/**
 * src/core/semantic-clipboard.ts
 *
 * Single-keystroke semantic clipboard: copies a context-rich text +
 * JSON-LD payload from the focused card to the system clipboard.
 *
 * Spec: docs/adr/ADR-070-x15-semantic-clipboard.md
 * Permissions-Policy: clipboard-write=(self) per ADR-056 / .
 * Zero dependencies.
 */

/**
 * Payload exposed by an opted-in card. Returned by the card's
 * `getSemanticPayload()` and consumed by the clipboard core.
 */
export interface SemanticPayload {
  /** Plain-text representation, ready for chat/email paste. */
  readonly text: string;
  /** JSON-LD block — typically schema.org Event/Place/Action. */
  readonly jsonLd: Readonly<Record<string, unknown>>;
  /** Source card registry ID. */
  readonly cardId: string;
  /** Wall-clock timestamp of the snapshot. */
  readonly ts: number;
}

/** Card-side producer signature. Cards implement this to opt in. */
export type SemanticPayloadProducer = () => SemanticPayload | null;

const _producers = new Map<string, SemanticPayloadProducer>();

/**
 * Register a producer for a given cardId. Idempotent — re-registration
 * replaces the previous producer.
 */
export function registerSemanticProducer(cardId: string, fn: SemanticPayloadProducer): void {
  _producers.set(cardId, fn);
}

/** Test/teardown only. */
export function _resetSemanticProducers(): void {
  _producers.clear();
}

/**
 * Resolve the payload for a given cardId, or `null` if no producer
 * is registered or the producer returns null.
 */
export function getSemanticPayload(cardId: string): SemanticPayload | null {
  const fn = _producers.get(cardId);
  if (!fn) return null;
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * Find the cardId of the closest ancestor with a `data-card-id`
 * attribute, walking up from `el`. Returns `null` if none found.
 */
export function findFocusedCardId(el: Element | null): string | null {
  let cur: Element | null = el;
  while (cur) {
    const id = cur.getAttribute?.("data-card-id");
    if (id) return id;
    cur = cur.parentElement;
  }
  return null;
}

/**
 * Write a SemanticPayload to the system clipboard. Prefers
 * `ClipboardItem` with `application/ld+json`; falls back to plain
 * text where unavailable (Safari < 16).
 *
 * Returns `true` on success, `false` on any failure (clipboard denied,
 * insecure context, etc.). Never throws.
 */
export async function writeSemanticPayload(payload: SemanticPayload): Promise<boolean> {
  if (!navigator.clipboard) return false;
  const jsonText = JSON.stringify(payload.jsonLd);
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      const item = new ClipboardItem({
        "text/plain": new Blob([payload.text], { type: "text/plain" }),
        "application/ld+json": new Blob([jsonText], {
          type: "application/ld+json",
        }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    // Fallback: text-only.
    await navigator.clipboard.writeText(payload.text);
    return true;
  } catch {
    return false;
  }
}

/**
 * High-level entry point bound to the `C` key. Resolves the focused
 * card, fetches its payload, writes to clipboard. Returns the cardId
 * on success, `null` if no payload was copied.
 */
export async function copyFocusedCardPayload(
  activeElement: Element | null = document.activeElement,
): Promise<string | null> {
  const cardId = findFocusedCardId(activeElement);
  if (!cardId) return null;
  const payload = getSemanticPayload(cardId);
  if (!payload) return null;
  const ok = await writeSemanticPayload(payload);
  return ok ? cardId : null;
}
