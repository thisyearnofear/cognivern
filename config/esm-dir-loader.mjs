export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      return nextResolve(new URL('./index.js', err.url).href, context);
    }
    if (err.code === 'ERR_MODULE_NOT_FOUND' && err.url && !err.url.endsWith('.js')) {
      try {
        return await nextResolve(err.url + '.js', context);
      } catch {
        return nextResolve(new URL('./index.js', err.url + '/').href, context);
      }
    }
    throw err;
  }
}
