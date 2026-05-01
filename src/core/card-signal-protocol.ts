/**
 * src/core/card-signal-protocol.ts — X12 (Sprint 365 / v13.38.0)
 *
 * Versioned typed signal protocol for sibling-card consumption.
 * Producers (cards) call `setCardSignal`; consumers (today-pane,
 * semantic links, MCP bridge, daily synthesis) call `getCardSignal`
 * or subscribe via `onCardSignal`.
 *
 * Spec: docs/adr/ADR-067-x12-card-signal-protocol.md
 * Zero dependencies. Deep-frozen values. Microtask-batched callbacks.
 */

/**
 * A typed signal exported by a card for sibling consumption.
 * Values are deep-frozen at write time; consumers must treat them as
 * read-only.
 */
export interface CardSignal<T> {
  readonly v: 1;
  readonly cardId: string;
  readonly key: string;
  readonly value: T;
  readonly ts: number;
}

type Listener<T> = (signal: CardSignal<T>) => void;

/** Internal registry — keyed by `${cardId}::${key}`. */
const _signals = new Map<string, CardSignal<unknown>>();
const _listeners = new Map<string, Set<Listener<unknown>>>();

function compositeKey(cardId: string, key: string): string {
  return `${cardId}::${key}`;
}

/**
 * Recursively freeze an object so consumers cannot mutate the payload.
 * Skips functions (none expected in payloads) and handles arrays.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.keys(value)) {
    const v = (value as Record<string, unknown>)[k];
    if (v && typeof v === "object") deepFreeze(v);
  }
  return value;
}

/**
 * Publish a signal under (cardId, key). The value is deep-frozen.
 * Subscribers are notified via `queueMicrotask` to avoid producer-
 * consumer re-entrancy.
 */
export function setCardSignal<T>(cardId: string, key: string, value: T): void {
  const ck = compositeKey(cardId, key);
  const frozen = deepFreeze(value);
  const signal: CardSignal<T> = Object.freeze({
    v: 1,
    cardId,
    key,
    value: frozen,
    ts: Date.now(),
  });
  _signals.set(ck, signal);

  const subs = _listeners.get(ck);
  if (subs && subs.size > 0) {
    const snapshot = Array.from(subs);
    queueMicrotask(() => {
      for (const cb of snapshot) {
        try {
          (cb as Listener<T>)(signal);
        } catch {
          /* listener errors must not break the producer */
        }
      }
    });
  }
}

/**
 * Read the latest signal for (cardId, key). Returns `null` if no
 * producer has published yet.
 */
export function getCardSignal<T>(cardId: string, key: string): CardSignal<T> | null {
  const sig = _signals.get(compositeKey(cardId, key));
  return (sig as CardSignal<T> | undefined) ?? null;
}

/**
 * Subscribe to future signals on (cardId, key). Returns an unsubscribe
 * function — consumers MUST call it on teardown.
 *
 * Does NOT fire immediately for the current value. Consumers needing
 * the current value should call `getCardSignal` first.
 */
export function onCardSignal<T>(
  cardId: string,
  key: string,
  cb: Listener<T>,
): () => void {
  const ck = compositeKey(cardId, key);
  let set = _listeners.get(ck);
  if (!set) {
    set = new Set();
    _listeners.set(ck, set);
  }
  set.add(cb as Listener<unknown>);
  return () => {
    const s = _listeners.get(ck);
    if (!s) return;
    s.delete(cb as Listener<unknown>);
    if (s.size === 0) _listeners.delete(ck);
  };
}

/**
 * Test-only: clear all signals + listeners. Not exported to barrel;
 * importers must reach in explicitly.
 */
export function _resetCardSignals(): void {
  _signals.clear();
  _listeners.clear();
}
