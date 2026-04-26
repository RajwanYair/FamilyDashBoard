/**
 * src/core/signals.ts — Sprint 100 (V14-SEMANTIC seed)
 *
 * Zero-dep, ~1 KB gzipped reactive primitive. Mirrors the TC39 Signals
 * proposal (Stage 3) and Lit Signals API surface so that, when either
 * ships in browsers / npm at acceptable polyfill size, the call sites
 * here are drop-in replaceable. **No runtime dependency** is added — the
 * whole implementation is the file you are reading.
 *
 * Public surface:
 *   - signal<T>(initial)           → Signal<T>            (read/write)
 *   - computed<T>(fn)              → ReadonlySignal<T>    (derived, lazy)
 *   - effect(fn)                   → () => void           (subscribe)
 *   - batch(fn)                    → T                    (defer notify)
 *   - untrack(fn)                  → T                    (read w/o dep)
 *   - isSignal(value)              → boolean              (type guard)
 *
 * Semantics:
 *   - Push-pull lazy evaluation (computed runs only when read after dirty).
 *   - Glitch-free: a single source change produces at most one effect run.
 *   - Effects run synchronously after the outermost batch() resolves.
 *   - Disposing an effect detaches it from every dependency immediately.
 *   - No cycle detection: a circular dependency throws at first re-entry.
 *
 * Why hand-rolled instead of Lit Signals? ADR-038 — a 200-LOC primitive
 * keeps the project at zero client deps and avoids tracking yet another
 * external version.
 */

const NO_VALUE: unique symbol = Symbol("signal/no-value");

interface Subscriber {
  /** Called when an upstream source mutates. */
  notify(): void;
  /** Cleanup hook for sub-trees attached during a previous run. */
  dispose?(): void;
}

interface Source<T> {
  readonly value: T;
  /** Register a subscriber that wants to be `.notify()`ed on change. */
  _subscribe(sub: Subscriber): void;
  _unsubscribe(sub: Subscriber): void;
}

let activeSubscriber: Subscriber | null = null;
let activeReads: Set<Source<unknown>> | null = null;
let batchDepth = 0;
const pendingEffects = new Set<EffectImpl>();

function track<T>(source: Source<T>): void {
  if (activeReads !== null) {
    activeReads.add(source as Source<unknown>);
  }
}

function flush(): void {
  if (batchDepth !== 0) return;
  // Drain the queue with a guard so effects scheduling further effects
  // are processed in the same flush instead of recursing.
  while (pendingEffects.size > 0) {
    const next = pendingEffects.values().next().value as EffectImpl;
    pendingEffects.delete(next);
    next._run();
  }
}

/**
 * Run `fn` under reactive tracking for the given `subscriber`.
 * Unsubscribes from `oldDeps`, collects new deps during the run, then
 * subscribes to them.  Returns the new dep set and the computed value.
 * If `fn` throws, context is restored and the exception re-propagates.
 */
function runTracked<T>(
  subscriber: Subscriber,
  oldDeps: Set<Source<unknown>>,
  fn: () => T,
): { value: T; deps: Set<Source<unknown>> } {
  for (const dep of oldDeps) dep._unsubscribe(subscriber);
  const newDeps = new Set<Source<unknown>>();
  const prevSub = activeSubscriber;
  const prevReads = activeReads;
  activeSubscriber = subscriber;
  activeReads = newDeps;
  let value!: T;
  try {
    value = fn();
  } finally {
    activeSubscriber = prevSub;
    activeReads = prevReads;
  }
  // Only reached when fn() returned without throwing.
  for (const dep of newDeps) dep._subscribe(subscriber);
  return { value, deps: newDeps };
}

class SignalImpl<T> implements Source<T> {
  private _value: T;
  private _subs = new Set<Subscriber>();

  constructor(initial: T) {
    this._value = initial;
  }

  get value(): T {
    track(this);
    return this._value;
  }

  set value(next: T) {
    if (Object.is(next, this._value)) return;
    this._value = next;
    // Snapshot to allow subscribers to add/remove during notify.
    for (const sub of [...this._subs]) sub.notify();
    flush();
  }

  peek(): T {
    return this._value;
  }

  _subscribe(sub: Subscriber): void {
    this._subs.add(sub);
  }

  _unsubscribe(sub: Subscriber): void {
    this._subs.delete(sub);
  }
}

class ComputedImpl<T> implements Source<T>, Subscriber {
  private _value: T | typeof NO_VALUE = NO_VALUE;
  private _dirty = true;
  private _subs = new Set<Subscriber>();
  private _deps: Set<Source<unknown>> = new Set();

  constructor(private readonly _fn: () => T) {}

  get value(): T {
    track(this);
    if (this._dirty) this._recompute();
    return this._value as T;
  }

  peek(): T {
    if (this._dirty) this._recompute();
    return this._value as T;
  }

  notify(): void {
    if (this._dirty) return;
    this._dirty = true;
    for (const sub of [...this._subs]) sub.notify();
  }

  _subscribe(sub: Subscriber): void {
    this._subs.add(sub);
  }

  _unsubscribe(sub: Subscriber): void {
    this._subs.delete(sub);
  }

  private _recompute(): void {
    const tracked = runTracked(this, this._deps, this._fn);
    this._value = tracked.value;
    this._dirty = false;
    this._deps = tracked.deps;
  }
}

class EffectImpl implements Subscriber {
  private _deps: Set<Source<unknown>> = new Set();
  private _disposed = false;

  constructor(private readonly _fn: () => void) {
    this._run();
  }

  notify(): void {
    if (this._disposed) return;
    pendingEffects.add(this);
  }

  _run(): void {
    if (this._disposed) return;
    const tracked = runTracked(this, this._deps, this._fn);
    this._deps = tracked.deps;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    for (const dep of this._deps) dep._unsubscribe(this);
    this._deps.clear();
    pendingEffects.delete(this);
  }
}

/** A read/write reactive cell. */
export interface Signal<T> extends ReadonlySignal<T> {
  value: T;
}

/** A read-only signal — used by computed() and external consumers. */
export interface ReadonlySignal<T> {
  readonly value: T;
  /** Read without registering a dependency on the active scope. */
  peek(): T;
}

/** Create a writable signal initialised to `initial`. */
export function signal<T>(initial: T): Signal<T> {
  return new SignalImpl(initial);
}

/** Create a derived signal whose value is recomputed lazily on demand. */
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  return new ComputedImpl(fn);
}

/**
 * Run `fn` immediately and re-run it whenever any signal it reads changes.
 * Returns a disposer that detaches the effect from all current dependencies.
 */
export function effect(fn: () => void): () => void {
  const e = new EffectImpl(fn);
  return (): void => e.dispose();
}

/**
 * Defer effect notifications until the outermost batch resolves. Returns
 * the value `fn` produced. Nested batches collapse into the outermost.
 */
export function batch<T>(fn: () => T): T {
  batchDepth += 1;
  try {
    return fn();
  } finally {
    batchDepth -= 1;
    flush();
  }
}

/** Read sources inside `fn` without registering them as dependencies. */
export function untrack<T>(fn: () => T): T {
  const prevSub = activeSubscriber;
  const prevReads = activeReads;
  activeSubscriber = null;
  activeReads = null;
  try {
    return fn();
  } finally {
    activeSubscriber = prevSub;
    activeReads = prevReads;
  }
}

/** Type guard — narrows `value` to `ReadonlySignal<unknown>` if it is one. */
export function isSignal(value: unknown): value is ReadonlySignal<unknown> {
  return value instanceof SignalImpl || value instanceof ComputedImpl;
}
