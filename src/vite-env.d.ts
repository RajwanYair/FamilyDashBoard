/// <reference types="vite/client" />

// v13.12.0: explicit CSS side-effect import + import.meta.env declarations
// so `tsc --noEmit` succeeds in CI even if `node_modules/vite/client.d.ts`
// resolution is finicky (see ci.yml / release.yml — workers and tools are
// installed via `--no-save` without a lockfile).
declare module "*.css" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly BASE_URL: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
/** ISO 8601 timestamp of the build (e.g. "2026-04-16T14:30:00.000Z"). */
declare const __BUILD_TIME__: string;
/** Controls whether the public CORS proxy chain is included in the bundle.
 *  Defaults to true (always retained as a safety net). Runtime override via
 *  localStorage `dash_network_mode` — see `src/core/constants.ts`. */
declare const __USE_PROXIES__: boolean;
