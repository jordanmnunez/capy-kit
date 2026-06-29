import { defineConfig, type Options } from "tsup";

// One core, projected into thin shells. Each package builds to its own dist/ as
// ESM JS targeting Node 18 so `npm i -g` works on plain Node (Bun is the dev path).
const common: Options = {
  format: ["esm"],
  target: "node18",
  platform: "node",
  dts: true,
  clean: true,
  sourcemap: false,
  treeshake: true,
};

export default defineConfig([
  {
    ...common,
    entry: { index: "packages/core/src/index.ts" },
    outDir: "packages/core/dist",
  },
  {
    ...common,
    entry: { capy: "packages/cli/src/bin/capy.ts" },
    outDir: "packages/cli/dist",
    // Declared deps are resolved from node_modules at runtime — never bundled.
    external: ["@capy-kit/core", "citty", "@clack/prompts"],
    banner: { js: "#!/usr/bin/env node" },
  },
  // capy-mcp / capy-mcp-http entries are added in M2.
]);
