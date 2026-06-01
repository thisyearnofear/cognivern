import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/frontend/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Frontend tests need jsdom — they're run from src/frontend/vitest.config.ts
    // which provides that. Exclude them here to avoid the wrong environment.
    include: [
      "src/backend/**/*.test.ts",
      "src/backend/**/*.test.tsx",
      "tests/**/*.test.ts",
    ],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/"],
    },
  },
});
