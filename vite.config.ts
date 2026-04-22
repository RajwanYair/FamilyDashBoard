import { defineConfig, type Plugin } from "vite";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const tempBase = join(tmpdir(), "fdb-dev");

// Read app version once at config time so all plugins share it.
const appVersion: string = (
  JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as {
    version: string;
  }
).version;

/**
 * Detect if this is a local (file://) build by checking --base ./ on the
 * CLI args.  process.argv is stable across platforms and requires no env vars.
 */
const isLocalBuild = (() => {
  const idx = process.argv.indexOf("--base");
  return idx !== -1 && process.argv[idx + 1] === "./";
})();

/**
 * Stream SW.4: Compile sw.ts → dist/sw.js via scripts/build-sw.mjs.
 * TypeScript's transpileModule strips type annotations; the script injects __APP_VERSION__.
 * This avoids a direct dependency on esbuild (not available as a standalone package in Vite 8).
 */
const injectSwVersion: Plugin = {
  name: "inject-sw-version",
  apply: "build",
  closeBundle() {
    execSync(`node scripts/build-sw.mjs ${appVersion}`, {
      cwd: resolve(__dirname),
      stdio: "inherit",
    });
  },
};

/**
 * Chrome blocks crossorigin CORS fetches on file:// origins.
 *
 * For LOCAL builds (--base ./) two additional transforms are applied:
 *  1. Strip the CSP <meta> tag — `script-src 'self'` for a null/file:// origin
 *     blocks ALL script execution because 'self' matches nothing on opaque
 *     origins, making the entire JS bundle silently unreachable.
 *  2. Rewrite absolute /FamilyDashBoard/ paths → relative ./ so manifest,
 *     icon, and SW scope resolve correctly from a local directory.
 */
const removeCrossOrigin: Plugin = {
  name: "remove-crossorigin",
  transformIndexHtml(html: string): string {
    let result = html.replace(/ crossorigin(?:="[^"]*")?/g, "");
    if (isLocalBuild) {
      // 1. Strip the CSP meta — opaque file:// origin makes 'self' = 'none'
      result = result.replace(
        /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*\/?>/gi,
        "",
      );
      // 2. Fix all /FamilyDashBoard/ absolute refs to relative for file://
      result = result.replace(/\/FamilyDashBoard\//g, "./");
      // 3. Convert module scripts to plain scripts — Chrome enforces CORS for
      //    type="module" fetches; file:// has no CORS headers, so they fail.
      //    The IIFE bundle has no runtime `import` statements, so plain <script>
      //    is functionally identical and loads without CORS restrictions.
      result = result.replace(/<script type="module"/g, "<script");
      // 4. Remove all modulepreload links — they're only meaningful for ES modules
      result = result.replace(/<link[^>]*rel="modulepreload"[^>]*\/?>\s*/gi, "");
    }
    return result;
  },
};

export default defineConfig(({ command }) => ({
  root: "src",
  base: "/FamilyDashBoard/",
  cacheDir: join(tempBase, ".vite"),
  plugins: [removeCrossOrigin, injectSwVersion],

  // v11.0-PERF-1: Use Lightning CSS for faster, smaller CSS builds.
  // Targets modern evergreen browsers that support all dashboard CSS features.
  css: {
    transformer: "lightningcss" as const,
    lightningcss: {
      targets: {
        chrome: 110 << 16,
        firefox: 115 << 16,
        safari: (16 << 16) | (4 << 8),
      },
    },
  },

  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // v8.0: production build strips proxy chain (Worker is sole data path).
    // true = dev server OR file:// local build — proxy fallback retained.
    __USE_PROXIES__: JSON.stringify(command === "serve" || isLocalBuild),
  },

  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
    minify: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
      },
      output: isLocalBuild
        ? {
            // Single self-contained IIFE for file:// access.
            // No ES module `import` statements at runtime = no CORS restrictions,
            // so Chrome can load this directly from file:// without --allow-file-access-from-files.
            format: "iife" as const,
            inlineDynamicImports: true,
            entryFileNames: "assets/[name]-[hash].js",
            chunkFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash].[ext]",
          }
        : {
            // GitHub Pages build: ES modules with code splitting for optimal caching.
            entryFileNames: "assets/[name]-[hash].js",
            chunkFileNames: "assets/[name]-[hash].js",
            assetFileNames: "assets/[name]-[hash].[ext]",
            manualChunks: (id: string) => {
              if (
                id.includes("/cards/weather/") ||
                id.includes("/cards/motivation/") ||
                id.includes("/cards/news/") ||
                id.includes("/cards/stocks/") ||
                id.includes("/cards/currency/") ||
                id.includes("/cards/alerts/") ||
                id.includes("/cards/hebrew-cal/") ||
                id.includes("/cards/calendar/")
              ) {
                return "cards";
              }
              if (id.includes("/cards/tasks/") || id.includes("/cards/system-info/")) {
                return "cards-v7";
              }
              if (id.includes("/core/card-registry") || id.includes("/types/card")) {
                return "card-infra";
              }
            },
          },
    },
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  // Suppress rolldown warning for IIFE local builds:
  // Vite has already replaced import.meta.env.* at transform time,
  // so the remaining import.meta references are only in Vite's own injected CSS
  // helper snippets which rolldown replaces with {} correctly.
  ...(isLocalBuild
    ? {
        define: {
          "import.meta": "{}",
          __APP_VERSION__: JSON.stringify(appVersion),
        },
      }
    : {}),

  server: {
    port: 3000,
    open: true,
  },

  preview: {
    port: 4173,
  },
}));
