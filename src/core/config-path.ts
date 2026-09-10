/**
 * Read and write schema-backed configuration values, including dotted paths
 * used by namespaced card settings.
 */

export type ConfigValue = string | number | boolean;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isConfigValue(value: unknown): value is ConfigValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function getConfigValue(source: object, path: string): ConfigValue | undefined {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;

  for (const part of parts) {
    if (!isRecord(current) || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }

  return isConfigValue(current) ? current : undefined;
}

export function setConfigValue(target: object, path: string, value: ConfigValue): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0 || !isRecord(target)) return;

  let current = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!isRecord(existing)) {
      const next: Record<string, unknown> = {};
      current[part] = next;
      current = next;
    } else {
      current = existing;
    }
  }

  const lastPart = parts.at(-1);
  if (lastPart) current[lastPart] = value;
}

export function getConfigSettingKey(path: string): string {
  return path.split(".").filter(Boolean).at(-1) ?? path;
}
