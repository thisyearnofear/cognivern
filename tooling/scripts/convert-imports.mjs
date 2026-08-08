#!/usr/bin/env node
// Converts deep relative imports to @/backend/ or @/ path aliases.

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TARGETS = [
  resolve(ROOT, "src/backend"),
  resolve(ROOT, "tests"),
  resolve(ROOT, "src/server.ts"),
  resolve(ROOT, "src/index.ts"),
  resolve(ROOT, "src/config.ts"),
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") files.push(...walk(p));
    else if (entry.name.endsWith(".ts")) files.push(p);
  }
  return files;
}

const allFiles = TARGETS.flatMap((t) =>
  statSync(t).isDirectory() ? walk(t) : [t],
);

// Patterns that contain relative paths (starting with ../)
const RELATIVE_RE = /(from\s+|require\(|vi\.mock\(|import\()["'](\.\.\/[^"']+)["']/g;

let convertedCount = 0;
let fileCount = 0;

for (const file of allFiles) {
  let content = readFileSync(file, "utf8");
  const dir = dirname(file);
  let changed = false;

  content = content.replace(RELATIVE_RE, (match, prefix, relPath) => {
    const resolved = resolve(dir, relPath);
    const rel = relative(ROOT, resolved);

    // Only convert paths under src/
    if (rel.startsWith("src/backend/")) {
      const backendRel = rel.slice("src/backend/".length);
      convertedCount++;
      return `${prefix}"@backend/${backendRel}"`;
    }
    if (rel.startsWith("src/") && !rel.startsWith("src/frontend/")) {
      const srcRel = rel.slice("src/".length);
      convertedCount++;
      return `${prefix}"@/${srcRel}"`;
    }
    return match; // leave as-is
  });

  if (content !== readFileSync(file, "utf8")) {
    writeFileSync(file, content, "utf8");
    fileCount++;
    changed = true;
    console.log(`  ${relative(ROOT, file)}`);
  }
}

console.log(`\nConverted ${convertedCount} imports across ${fileCount} files.`);
