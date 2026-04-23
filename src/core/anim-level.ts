/**
 * FamilyDashBoard — Animation Level Runtime
 *
 * Reads config.animLevel and stamps `data-anim-level` on <body>.
 * CSS rules keyed on that attribute control which animations are active.
 *
 * Levels:
 *   none    — all animation/transition disabled (accessibility / no-distraction)
 *   minimal — only essential state feedback (sync dots), no decorative motion
 *   normal  — default: smooth transitions, loop-scroll, card hover effects
 *   full    — everything: animated borders, glow on hover, all extras
 */

import type { DashboardConfig } from "../types/config";

const ANIM_LEVELS = ["none", "minimal", "normal", "full"] as const;
type AnimLevel = (typeof ANIM_LEVELS)[number];

/**
 * Apply animation level to <body>.
 * Stamps `data-anim-level="<level>"` which CSS consumes.
 * Also sets `data-reduced-motion="true"` when effective level is "none" or "minimal"
 * so components can query it without re-parsing CSS.
 */
export function applyAnimLevel(level: DashboardConfig["animLevel"]): void {
  const safe: AnimLevel = ANIM_LEVELS.includes(level)
    ? level
    : "normal";
  document.body.dataset["animLevel"] = safe;
}

/**
 * Derive effective animation level by reconciling:
 *   1. User-configured level (config.animLevel)
 *   2. OS prefers-reduced-motion preference
 *
 * Rules:
 *   - If user chose "full" → always full (user override takes precedence)
 *   - If OS has prefers-reduced-motion AND user is on "normal" → clamp to "minimal"
 *   - Everything else → use config value as-is
 */
export function effectiveAnimLevel(
  configLevel: DashboardConfig["animLevel"],
): DashboardConfig["animLevel"] {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (configLevel === "full") return "full";
  if (prefersReduced && configLevel === "normal") return "minimal";
  return configLevel;
}

/**
 * Load the config animation level and apply it to <body>.
 * Pass the full config object (already loaded) to avoid a redundant localStorage read.
 */
export function applyConfigAnimLevel(cfg: DashboardConfig): void {
  applyAnimLevel(effectiveAnimLevel(cfg.animLevel));
}
