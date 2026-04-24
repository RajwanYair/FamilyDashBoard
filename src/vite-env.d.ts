/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
/** ISO 8601 timestamp of the build (e.g. "2026-04-16T14:30:00.000Z"). */
declare const __BUILD_TIME__: string;
/** Controls whether the public CORS proxy chain is included in the bundle.
 *  Defaults to true (always retained as a safety net). Runtime override via
 *  localStorage `dash_network_mode` — see `src/core/constants.ts`. */
declare const __USE_PROXIES__: boolean;
