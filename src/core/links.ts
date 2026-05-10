/**
 * Semantic-link service.
 *
 * Provides a lightweight, dependency-free registry that lets cards declare
 * directional semantic relationships (e.g. "stocks → weather") so the shell
 * can surface contextually related content.
 *
 * Rules enforced here:
 *  - One registered resolver per (fromCardId, toCardId) direction.
 *  - Re-registering the same direction replaces the previous resolver.
 *  - Gated by `semanticLinksEnabled` toggle in the live config; when the
 *    toggle is off `getLinks()` always returns [].
 */

import { loadConfig } from "./config";

/** The resolver function type: computes the link payload at call time. */
export type LinkResolver = () => string | null;

/** A registered semantic link. */
export interface SemanticLink {
  fromCardId: string;
  toCardId: string;
  resolver: LinkResolver;
}

// ── Internal registry ──────────────────────────────────────────────────────

/** Composite key used to enforce one-resolver-per-direction. */
function linkKey(fromCardId: string, toCardId: string): string {
  return `${fromCardId}→${toCardId}`;
}

const _registry = new Map<string, SemanticLink>();

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Register (or replace) a directional semantic link from `fromCardId` to
 * `toCardId`.  Only one resolver per direction is kept — a second call with
 * the same direction replaces the previous resolver.
 */
export function registerLink(fromCardId: string, toCardId: string, resolver: LinkResolver): void {
  _registry.set(linkKey(fromCardId, toCardId), {
    fromCardId,
    toCardId,
    resolver,
  });
}

/**
 * Return all semantic links originating from `cardId`.
 * Returns an empty array when the `semanticLinksEnabled` config toggle is
 * falsy or when no links are registered for `cardId`.
 */
export function getLinks(cardId: string): SemanticLink[] {
  const cfg = loadConfig();
  if (!cfg.semanticLinksEnabled) return [];
  const result: SemanticLink[] = [];
  for (const link of _registry.values()) {
    if (link.fromCardId === cardId) result.push(link);
  }
  return result;
}

/**
 * Remove all registered links.  Primarily used in tests and when the user
 * disables the feature entirely.
 */
export function clearLinks(): void {
  _registry.clear();
}
