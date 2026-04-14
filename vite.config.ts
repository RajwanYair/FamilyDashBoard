import { defineConfig, type Plugin } from "vite";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

const tempBase = join(tmpdir(), "fdb-dev");

/** Remove crossorigin attributes so the built app loads from file:// URLs.
 *  Chrome blocks crossorigin CORS fetches on file:// origins; without these
 *  attributes standard module loading works fine (no SRI hashes are used). */
const removeCrossOrigin: Plugin = {
  name: "remove-crossorigin",
  transformIndexHtml(html: string): string {
    return html.replace(/ crossorigin(?:="[^"]*")?/g, "");
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
