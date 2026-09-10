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
import { diagLog } from "./diag";

/** The resolver function type: computes the link payload at call time. */
export type SemanticLinkPayload = string | null;
export type LinkResolver = () => SemanticLinkPayload;

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
 * Return one registered semantic link, or null when the direction is absent
 * or the feature is disabled.
 */
export function getLink(fromCardId: string, toCardId: string): SemanticLink | null {
  const cfg = loadConfig();
  if (!cfg.semanticLinksEnabled) return null;
  return _registry.get(linkKey(fromCardId, toCardId)) ?? null;
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
 * Resolve a registered payload at call time.
 *
 * Resolver failures are isolated to their link and recorded for diagnostics;
 * a missing or disabled link is represented by null rather than stale data.
 */
export function resolveLink(link: SemanticLink): SemanticLinkPayload {
  const cfg = loadConfig();
  if (!cfg.semanticLinksEnabled) return null;
  try {
    const payload = link.resolver();
    if (payload === null || typeof payload === "string") return payload;
    diagLog(`[links] Resolver returned an invalid payload for ${link.fromCardId}→${link.toCardId}`);
  } catch {
    diagLog(`[links] Resolver failed for ${link.fromCardId}→${link.toCardId}`);
  }
  return null;
}

/**
 * Remove one registered direction.
 *
 * Returns true only when a matching registration existed. The registry is
 * updated even while the feature is disabled so remount cleanup is reliable.
 */
export function unregisterLink(fromCardId: string, toCardId: string): boolean {
  return _registry.delete(linkKey(fromCardId, toCardId));
}

/**
 * Remove all registered links.  Primarily used in tests and when the user
 * disables the feature entirely.
 */
export function clearLinks(): void {
  _registry.clear();
}
