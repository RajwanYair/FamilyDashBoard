/**
 * Worker-side privacy helpers for fields that may contain user-configured URLs.
 *
 * Query strings are intentionally removed before values are logged or persisted.
 * Calendar feeds and custom proxies can use bearer-like query tokens.
 */

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;

export function redactUrlText(value: string): string {
  return value.replace(URL_PATTERN, (candidate) => {
    try {
      const url = new URL(candidate);
      return `${url.origin}${url.pathname}`;
    } catch {
      return "[redacted-url]";
    }
  });
}
