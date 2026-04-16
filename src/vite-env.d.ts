/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
/** ISO 8601 timestamp of the build (e.g. "2026-04-16T14:30:00.000Z"). */
declare const __BUILD_TIME__: string;
/** True in dev/test; can be set to false in CI to strip proxy URLs from production builds. */
declare const __USE_PROXIES__: boolean;
