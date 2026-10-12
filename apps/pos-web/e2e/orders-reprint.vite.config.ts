import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("test"),
  },
  build: {
    outDir: path.join("e2e", ".tmp-orders-reprint"),
    emptyOutDir: true,
    lib: {
      entry: path.join("e2e", "orders-reprint-composition-harness.tsx"),
      name: "OrdersReprintHarness",
      formats: ["iife"],
      fileName: () => "harness.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    minify: false,
    target: "es2022",
  },
});
