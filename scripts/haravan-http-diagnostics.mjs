// The CLI hides HTTP failures behind a generic message and exit code 0.
// Report only status codes for theme asset requests, never headers or bodies.
const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  globalThis.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    let pathname;
    try {
      pathname = new URL(args[0] instanceof Request ? args[0].url : String(args[0])).pathname;
    } catch {
      return response;
    }
    if (!response.ok && /^\/web\/themes\/\d+\/assets\.json$/.test(pathname)) {
      console.error(`[HARAVAN_ASSET_HTTP_ERROR:${response.status}]`);
    }
    return response;
  };
}
