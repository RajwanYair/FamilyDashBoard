/**
 * src/types/semantic-clipboard.ts — public type re-export for X15.
 *
 * Cards opt-in by importing `SemanticPayload` from here and calling
 * `registerSemanticProducer` from `src/core/semantic-clipboard`.
 *
 *
 */

export type { SemanticPayload, SemanticPayloadProducer } from "../core/semantic-clipboard";
