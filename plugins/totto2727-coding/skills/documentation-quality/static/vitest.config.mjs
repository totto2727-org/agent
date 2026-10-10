import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { vitest: fileURLToPath(import.meta.resolve("vitest")) },
  },
  test: {
    include: ["tests/**/*.test.mjs"],
  },
});
