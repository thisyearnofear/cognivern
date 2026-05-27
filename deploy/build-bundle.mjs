#!/usr/bin/env node

// Bundles the backend into a single file for lean server deployment.
// Native modules are marked external and installed separately on the server.

import { build } from "esbuild";
import {
  rmSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "deploy-bundle");

// Packages that can't be bundled:
// - Native modules (contain .node binaries)
// - WASM packages (need filesystem assets at runtime)
// - Frontend-only packages
const NATIVE_EXTERNALS = [
  "better-sqlite3",
  "bufferutil",
  "utf-8-validate",
  "secp256k1",
  "keccak",
  // WASM packages that load files from disk at runtime
  "@cofhe/sdk",
  "@fhenixprotocol/cofhe-contracts",
  "node-tfhe",
  // Frontend-only packages that shouldn't be in the backend bundle
  "@wagmi/*",
  "@rainbow-me/*",
  "@tanstack/*",
  "react",
  "react-dom",
  "next",
];

// Clean output
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

console.log("[build] Bundling backend with esbuild...");

await build({
  entryPoints: [resolve(ROOT, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: resolve(OUT_DIR, "server.mjs"),
  sourcemap: process.argv.includes("--sourcemap"),
  minify: false, // keep readable for debugging on server
  treeShaking: true,
  external: NATIVE_EXTERNALS,
  // Resolve workspace package
  alias: {
    "@cognivern/shared": resolve(ROOT, "packages/shared/src/index.ts"),
  },
  banner: {
    js: [
      "import { createRequire } from 'node:module';",
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  logLevel: "info",
});

// Create minimal package.json with only native deps
const pkg = {
  name: "cognivern-backend-runtime",
  version: "0.1.0",
  private: true,
  type: "module",
  engines: { node: ">=22.0.0" },
  dependencies: {
    "better-sqlite3": "12.10.0",
    bufferutil: "^4.0.8",
    "utf-8-validate": "^6.0.4",
    secp256k1: "^5.0.1",
    keccak: "^3.0.4",
    "@cofhe/sdk": "0.5.1",
    "@fhenixprotocol/cofhe-contracts": "0.1.3",
  },
};

writeFileSync(
  resolve(OUT_DIR, "package.json"),
  JSON.stringify(pkg, null, 2) + "\n",
);

// Copy static policy files if they exist
const policiesDir = resolve(ROOT, "src/backend/modules/api/controllers");
// (policies are loaded from DB now, no static files needed)

console.log("[build] Bundle created at deploy-bundle/");
console.log("[build] Contents:");
console.log("  - server.mjs (bundled backend)");
console.log("  - server.mjs.map (source map)");
console.log("  - package.json (native deps only)");
