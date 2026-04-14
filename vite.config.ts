import { defineConfig, type Plugin } from "vite";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const tempBase = join(tmpdir(), "fdb-dev");

/**
 * Detect if this is a local (file://) build by checking --base ./ on the
 * CLI args.  process.argv is stable across platforms and requires no env vars.
 */
const isLocalBuild = (() => {
  const idx = process.argv.indexOf("--base");
  return idx !== -1 && process.argv[idx + 1] === "./";
})();

/**
 * Remove crossorigin attributes so the built app loads from file:// URLs.
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
    }
    return result;
  },
};

export default defineConfig({
  root: "src",
  base: "/FamilyDashBoard/",
  cacheDir: join(tempBase, ".vite"),
  plugins: [removeCrossOrigin],

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
      output: {
        // Deterministic chunk names for long-term caching
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
          if (
            id.includes("/cards/tasks/") ||
            id.includes("/cards/system-info/")
          ) {
            return "cards-v7";
          }
          if (
            id.includes("/core/card-registry") ||
            id.includes("/types/card")
          ) {
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

  server: {
    port: 3000,
    open: true,
  },

  preview: {
    port: 4173,
  },
});
