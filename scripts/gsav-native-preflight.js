#!/usr/bin/env node
const baseUrl = (process.env.EXPO_PUBLIC_GSAV_WEB_URL || process.env.GSAV_WEB_URL || 'http://127.0.0.1:5191').replace(/\/+$/, '');
const timeoutMs = Number.parseInt(process.env.GSAV_NATIVE_PREFLIGHT_TIMEOUT_MS || '10000', 10);
const skipLocalAsset = process.env.GSAV_NATIVE_PREFLIGHT_SKIP_LOCAL_ASSET === '1';

const routes = [
  { name: 'home', path: '/' },
  { name: 'native diagnostics', path: '/native-diagnostics?embed=native' },
  { name: 'watch test', path: '/watch/test?embed=native' },
  { name: 'watch test start time', path: '/watch/test?t=2.5&embed=native' },
  { name: 'watch elly', path: '/watch/elly?embed=native' }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toUrl(path) {
  return new URL(path, `${baseUrl}/`).toString();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkRoute(route) {
  const url = toUrl(route.path);
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  const text = await response.text();
  const contentType = response.headers.get('content-type');
  const result = {
    name: route.name,
    url,
    status: response.status,
    contentType,
    hasAppRoot: text.includes('id="root"')
  };

  assert(response.ok, `${route.name} returned ${response.status}`);
  assert(result.hasAppRoot, `${route.name} did not return the GSAV app shell`);
  return result;
}

async function checkLocalRangeAsset() {
  if (skipLocalAsset) {
    return {
      skipped: true,
      reason: 'GSAV_NATIVE_PREFLIGHT_SKIP_LOCAL_ASSET=1'
    };
  }

  const url = toUrl('/test.gsav');
  const response = await fetchWithTimeout(url, {
    headers: {
      Range: 'bytes=0-1023'
    }
  });
  const result = {
    url,
    status: response.status,
    acceptRanges: response.headers.get('accept-ranges'),
    contentRange: response.headers.get('content-range'),
    contentLength: response.headers.get('content-length')
  };

  assert(response.status === 206, `/test.gsav range request returned ${response.status}, expected 206`);
  assert(result.acceptRanges?.toLowerCase() === 'bytes', '/test.gsav did not advertise Accept-Ranges: bytes');
  assert(Boolean(result.contentRange), '/test.gsav did not return Content-Range');
  return result;
}

async function main() {
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0, `Invalid timeout: ${process.env.GSAV_NATIVE_PREFLIGHT_TIMEOUT_MS}`);

  const routeResults = [];
  for (const route of routes) {
    routeResults.push(await checkRoute(route));
  }

  const localAsset = await checkLocalRangeAsset();
  console.log(JSON.stringify({
    baseUrl,
    checkedAt: new Date().toISOString(),
    routes: routeResults,
    localAsset
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    baseUrl,
    checkedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
});
