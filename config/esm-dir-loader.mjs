import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const APP_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const ALIASES = {
  "@backend": "src/backend",
  "@": "src",
};

export async function resolve(specifier, context, nextResolve) {
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias + "/") || specifier === alias) {
      const rest = specifier.slice(alias.length);
      const filePath = resolve(APP_DIR, target + rest);
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
