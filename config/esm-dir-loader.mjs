import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";

const APP_DIR = pathResolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const ALIASES = {
  "@backend": "dist/src/backend",
  "@": "dist/src",
  // Workspace shared package (demo-policy + shared types). tsc emits it into
  // dist/packages/shared/src, so "@cognivern/shared" imports resolve on
  // the deployed box without a node_modules entry. Backend code imports both
  // the bare package and subpaths (e.g. "@cognivern/shared/rails"), so the
  // alias maps to the built directory and the bare specifier to its index.js.
  "@cognivern/shared": "dist/packages/shared/src",
};

async function resolveWithFallbacks(url, context, nextResolve) {
  try {
    return await nextResolve(url, context);
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

export async function resolve(specifier, context, nextResolve) {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias + "/") || specifier === alias) {
      const rest = specifier === alias ? "/index.js" : specifier.slice(alias.length);
      const filePath = pathResolve(APP_DIR, target + rest);
      return resolveWithFallbacks(new URL("file://" + filePath).href, context, nextResolve);
    }
  }

  return resolveWithFallbacks(specifier, context, nextResolve);
}
