import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";

const APP_DIR = pathResolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const ALIASES = {
  "@backend": "dist/src/backend",
  "@": "dist/src",
  // Workspace shared package (demo-policy + shared types). tsc emits it into
  // dist/packages/shared/src, so a bare "@cognivern/shared" import resolves on
  // the deployed box without a node_modules entry. (No backend code imports a
  // shared subpath, so mapping the package name to its built index.js is safe.)
  "@cognivern/shared": "dist/packages/shared/src/index.js",
};

export async function resolve(specifier, context, nextResolve) {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias + "/") || specifier === alias) {
      const rest = specifier.slice(alias.length);
      const filePath = pathResolve(APP_DIR, target + rest);
      return nextResolve(new URL("file://" + filePath).href, context);
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_UNSUPPORTED_DIR_IMPORT") {
      return nextResolve(new URL("./index.js", err.url).href, context);
    }
    if (err.code === "ERR_MODULE_NOT_FOUND" && err.url && !err.url.endsWith(".js")) {
      try {
        return await nextResolve(err.url + ".js", context);
      } catch {
        return nextResolve(new URL("./index.js", err.url + "/").href, context);
      }
    }
    throw err;
  }
}
