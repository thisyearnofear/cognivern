/**
 * Minimal localStorage stub for tests that touch persisted zustand stores.
 * The jsdom environment in this repo does not expose a working Storage, so
 * the persist middleware would otherwise crash on the first write. Import
 * this module before importing any store.
 */
const backing = new Map<string, string>();
const storage = {
  getItem: (key: string) => (backing.has(key) ? backing.get(key)! : null),
  setItem: (key: string, value: string) => {
    backing.set(key, String(value));
  },
  removeItem: (key: string) => {
    backing.delete(key);
  },
  clear: () => backing.clear(),
  key: (index: number) => Array.from(backing.keys())[index] ?? null,
  get length() {
    return backing.size;
  },
};

if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage?.setItem) {
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}
