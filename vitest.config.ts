import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run against SOURCE (no build step) and are network-free: ops are exercised
// over an injected `fetch` (mockTransport). The one live smoke test self-skips
// unless CAPY_API_KEY is set.
const coreSrc = fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@capy-kit/core": coreSrc },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
    globals: false,
    passWithNoTests: true,
  },
});
