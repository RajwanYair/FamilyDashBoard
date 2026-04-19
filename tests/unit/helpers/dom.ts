/**
 * Shared DOM helpers for FamilyDashBoard unit tests.
 *
 * Usage:
 *   import { setCardDOM, cleanupDOM } from "@tests/helpers";
 *
 *   beforeEach(() => setCardDOM({ bodyId: "weather-body" }));
 *   afterEach(cleanupDOM);
 */

export interface CardDOMOptions {
  /** ID of the card body element, e.g. "weather-body". */
  bodyId: string;
  /** Optional extra HTML injected inside the card body. */
  innerHTML?: string;
  /** Additional top-level elements to append to document.body. */
  extra?: string;
}

/**
 * Replace `document.body.innerHTML` with a minimal card shell.
 * Sufficient for all cards that require only `<div id="X-body">`.
 */
export function setCardDOM(opts: CardDOMOptions): void {
  document.body.innerHTML = `
    <div class="card" data-card-id="${opts.bodyId.replace(/-body$/, "")}">
      <div class="card-header"></div>
      <div id="${opts.bodyId}" class="card-body">${opts.innerHTML ?? ""}</div>
    </div>
    ${opts.extra ?? ""}
  `;
}

/**
 * Set full custom HTML on document.body.
 * Use when a card requires a more complex DOM that setCardDOM cannot express.
 */
export function setDOM(html: string): void {
  document.body.innerHTML = html;
}

/** Remove all body children and clear the DOM. Call in afterEach. */
export function cleanupDOM(): void {
  document.body.innerHTML = "";
}

/**
 * Wait for `count` microtask ticks — flushes async loaders, Promises, and
 * microtask-based state updates without advancing real time.
 */
export async function flushAsync(count = 50): Promise<void> {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
}

/**
 * Query a required element from the document. Throws if not found.
 * Avoids repeated non-null assertions in test code.
 */
export function getEl<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Test DOM: element not found: ${selector}`);
  return el;
}

/**
 * Query by ID, throw if not found. Sugar for `getEl("#id")`.
 */
export function getById<T extends HTMLElement = HTMLElement>(id: string): T {
  return getEl<T>(`#${id}`);
}
