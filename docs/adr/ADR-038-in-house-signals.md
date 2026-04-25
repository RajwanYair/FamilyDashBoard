# ADR-038 — In-house Signals Primitive (Zero-dep TC39 / Lit Signals Mirror)

| Field        | Value                                                                |
| ------------ | -------------------------------------------------------------------- |
| **Date**     | 2026-04-26                                                           |
| **Status**   | Accepted                                                             |
| **Deciders** | @RajwanYair                                                          |
| **Tags**     | core, state, reactivity, v14-semantic, zero-dep                      |

---

## Context

`src/core/state.ts` is an `EventTarget`-based key/value store with imperative `get`/`set`/`subscribe`. It works, but:

1. Every consumer must declare its own subscription lifecycle and tear-down.
2. There is no concept of a *derived* value that auto-recomputes — cards roll their own caches.
3. Glitch-free batched updates are the consumer's responsibility.

The roadmap (ROADMAP §3.2 V14-SEMANTIC) targets adoption of the Stage-3 TC39 Signals proposal once the polyfill ships at ≤ 1.5 KB gzip. Until then, the leading bridge is **Lit Signals** (~1 KB).

Adding `@lit-labs/signals` would violate ADR-002 (zero client runtime dependencies). It would also tie us to Lit's release cadence and to any breaking changes Lit makes between now and TC39 Stage 4.

## Decision

Ship a **hand-rolled** `signal` / `computed` / `effect` / `batch` / `untrack` primitive in `src/core/signals.ts`. The implementation is ~200 LOC, zero deps, and mirrors the public API surface of both the TC39 proposal and Lit Signals so call sites can migrate to either with a one-line import change.

### Public surface

```ts
signal<T>(initial): Signal<T>           // read/write
computed<T>(fn): ReadonlySignal<T>      // derived, lazy, cached
effect(fn): () => void                  // subscribe, returns disposer
batch<T>(fn): T                         // defer notifications
untrack<T>(fn): T                       // read without dependency
isSignal(v): v is ReadonlySignal<unk>   // type guard
```

### Semantics (matching TC39 + Lit)

- **Push-pull**: signals push *invalidations*; computed values pull *recomputations* on demand.
- **Glitch-free**: a single source change produces at most one effect run per affected effect.
- **Object.is equality**: writes equal under `Object.is` skip notification (so `NaN === NaN` is treated as no-op).
- **Synchronous effects**: dispatched at the close of the outermost `batch()` (or immediately if not batched).
- **Disposable**: `effect()` returns a disposer that detaches from every dependency; idempotent.

## Alternatives considered

| Option                                             | Verdict      | Reason                                                              |
| -------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| `@lit-labs/signals`                                | **Reject**   | First runtime dep on the client; ADR-002 violation.                 |
| `@preact/signals-core`                             | Reject       | Adds 2 KB and a vendor lock-in to Preact's release cadence.         |
| `solid-js` reactivity primitive only               | Reject       | Bundling Solid's reactivity drags > 5 KB with tree-shake leakage.   |
| Stay on `state.ts` only                            | Reject       | No derivation primitive blocks V14-SEMANTIC migration.              |
| Wait for TC39 Stage 4 polyfill                     | Reject       | Could be 12+ months; we want the migration to start now.            |

## Consequences

### Positive

- Zero new client deps; ADR-002 holds.
- Cards can incrementally migrate from `state.ts.subscribe()` to `effect()` with minimal call-site delta.
- When TC39 Stage 4 polyfill arrives at ≤ 1.5 KB gzip, the migration is a single-file replacement: `src/core/signals.ts` re-exports the polyfill module.
- Test coverage on a hand-rolled primitive is fully under our control (Sprint 101 ships 19 tests).

### Negative

- We own ~200 LOC of reactivity code and any subtle bugs.
- No automatic subscription lifecycle integration with `<fdb-card>` yet — that comes in V14-SEMANTIC follow-on sprints.
- Cycle detection is intentionally absent; a circular `computed` will throw on first re-entry rather than silently loop.

### Migration plan (from ROADMAP §3.2)

1. **v13.9 / Sprint 100** *(this ADR)*: ship primitive + tests + ADR.
2. **v14.0**: opt-in migration of `state.ts` slices, card-at-a-time. New cards must use `signal`/`computed` exclusively.
3. **v14.x**: when TC39 polyfill ≤ 1.5 KB, replace internals of `src/core/signals.ts` with a re-export of the polyfill. No call-site changes.
4. **v15**: remove `state.ts` once every consumer is on signals.

## References

- TC39 proposal: <https://github.com/tc39/proposal-signals>
- Lit Signals (1.0): <https://lit.dev/docs/data/signals/>
- ROADMAP §3.2 V14-SEMANTIC
- ADR-002 (zero-client-deps)
