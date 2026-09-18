import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // envio's handler loader registers tsx/esm and imports the handler file
    // itself — inlining keeps envio and the handler on the same ESM module
    // graph so the import doesn't hit a require(esm) cycle.
    server: {
      deps: {
        inline: ["envio", "tsx"],
      },
    },
  },
});
