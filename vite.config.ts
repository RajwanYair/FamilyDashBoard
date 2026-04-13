import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  base: "/FamilyDashBoard/",

  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
    minify: "esbuild",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "src/index.html"),
      },
      output: {
        // Deterministic chunk names for long-term caching
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: {
          // All card loaders in a separate chunk
          cards: [
            "./src/cards/weather/weather.ts",
            "./src/cards/motivation/motivation.ts",
            "./src/cards/news/news.ts",
            "./src/cards/stocks/stocks.ts",
            "./src/cards/currency/currency.ts",
            "./src/cards/alerts/alerts.ts",
          ],
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
