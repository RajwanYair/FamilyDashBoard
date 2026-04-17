/**
 * FamilyDashBoard — Hardware Capability Detection
 *
 * Detects CPU cores, device memory, and GPU tier.
 * Applies up to 60 % of hardware resources for dashboard use.
 *
 * CSS adaptive effects are gated via `data-hw-tier` on <html>:
 *   [data-hw-tier="high"] — all effects + full GPU compositing
 *   [data-hw-tier="mid"]  — standard effects, selective compositing
 *   [data-hw-tier="low"]  — reduced animations, no expensive GPU ops
 */

export type HardwareTier = "high" | "mid" | "low";

export interface GPUInfo {
  renderer: string;
  vendor: string;
  tier: HardwareTier;
}

export interface HardwareProfile {
  /** Logical CPU core count (navigator.hardwareConcurrency). */
  cpuCores: number;
  /** Recommended parallel fetch/task concurrency (60 % of cores, capped 2–8). */
  optimalConcurrency: number;
  /** Device RAM in GB (navigator.deviceMemory, default 4). */
  memoryGB: number;
  /** Combined tier summarising CPU + RAM + GPU. */
  tier: HardwareTier;
  /** WebGL GPU details. */
  gpu: GPUInfo;
}

// High-end GPU keywords (discrete NVIDIA / AMD / Intel Arc)
const GPU_HIGH_RE =
  /rtx\s?\d|gtx\s?[89]\d{2}|rx\s?[5-9]\d{2,}|geforce|arc\s?a[5-9]\d{2}|radeon\s?pro/i;

// Software / old / weak GPU keywords
const GPU_LOW_RE =
  /swiftshader|llvmpipe|software\s?rast|microsoft basic display|intel.*hd\s?[2-4]\d{3}/i;

// ── GPU Detection ────────────────────────────────────────────────────────────

function detectGPU(): GPUInfo {
  const unknown: GPUInfo = { renderer: "unknown", vendor: "unknown", tier: "mid" };
  if (typeof document === "undefined") return unknown;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return unknown;

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) {
      // Release context early
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return unknown;
    }

    const renderer =
      (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string | null) ?? "unknown";
    const vendor =
      (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string | null) ?? "unknown";

    const tier: HardwareTier = GPU_LOW_RE.test(renderer)
      ? "low"
      : GPU_HIGH_RE.test(renderer)
        ? "high"
        : "mid";

    gl.getExtension("WEBGL_lose_context")?.loseContext();

    return { renderer, vendor, tier };
  } catch {
    return unknown;
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────

let _profile: HardwareProfile | null = null;

/**
 * Build (or return cached) hardware profile.
 * Scoring:
 *   CPU  ≥8 cores → +2, ≥4 → +1
 *   RAM  ≥8 GB    → +2, ≥4 → +1
 *   GPU  high     → +2, mid → +1
 *   Total ≥5 → high, ≥2 → mid, else → low
 */
export function getHardwareProfile(): HardwareProfile {
  if (_profile) return _profile;

  const cores =
    (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : undefined) ?? 4;

  const memGB =
    (typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined) ?? 4;

  const gpu = detectGPU();

  const optimalConcurrency = Math.max(2, Math.min(8, Math.floor(cores * 0.6)));

  // Composite score
  let score = 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += memGB >= 8 ? 2 : memGB >= 4 ? 1 : 0;
  score += gpu.tier === "high" ? 2 : gpu.tier === "mid" ? 1 : 0;

  const tier: HardwareTier = score >= 5 ? "high" : score >= 2 ? "mid" : "low";

  _profile = { cpuCores: cores, optimalConcurrency, memoryGB: memGB, tier, gpu };
  return _profile;
}

// ── Convenience accessors ────────────────────────────────────────────────────

export function getHardwareTier(): HardwareTier {
  return getHardwareProfile().tier;
}

export function getOptimalConcurrency(): number {
  return getHardwareProfile().optimalConcurrency;
}

export function getGPUInfo(): GPUInfo {
  return getHardwareProfile().gpu;
}

export function getCPUCores(): number {
  return getHardwareProfile().cpuCores;
}

export function getDeviceMemoryGB(): number {
  return getHardwareProfile().memoryGB;
}

// ── DOM Integration ──────────────────────────────────────────────────────────

/**
 * Apply hardware tier as `data-hw-tier` attribute on <html>.
 * CSS rules gate expensive effects via attribute selectors:
 *   [data-hw-tier="high"]  — full GPU compositing + all animations
 *   [data-hw-tier="mid"]   — standard compositing, most animations
 *   [data-hw-tier="low"]   — reduced animations, no backdrop-filter
 */
export function applyHardwareTier(): void {
  if (typeof document === "undefined") return;
  const profile = getHardwareProfile();
  document.documentElement.dataset["hwTier"] = profile.tier;
  // Expose aggregate concurrency as CSS custom property for JS reads
  document.documentElement.style.setProperty(
    "--hw-concurrency",
    String(profile.optimalConcurrency),
  );
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

/** One-line summary for the diagnostics overlay. */
export function formatHardwareProfile(): string {
  const p = getHardwareProfile();
  const gpuShort = p.gpu.renderer.length > 40
    ? p.gpu.renderer.slice(0, 37) + "…"
    : p.gpu.renderer;
  return `${p.cpuCores} CPU | ${p.memoryGB} GB RAM | GPU: ${gpuShort} | tier: ${p.tier}`;
}

/** @internal — reset cached profile (test helper). */
export function _resetHardwareProfile(): void {
  _profile = null;
}
