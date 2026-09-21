/**
 * Pretty URLs for salam-doctor.com
 * - Utilities: /about.html → /about (serve about.html)
 * - Money hubs: never strip .html into a root stub — one-hop 301 → /shiraz KEEP
 */

const INTERNAL_HEADER = 'X-Pretty-URL-Internal';

const PASSTHROUGH_EXACT = new Set([
  '/',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap-articles.xml',
  '/favicon.ico',
]);

const PASSTHROUGH_PREFIXES = ['/api/', '/cdn-cgi/', '/services/', '/shiraz/', '/doctor/', '/tehran/'];

const ASSET_EXT =
  /\.(css|js|mjs|map|json|xml|txt|csv|pdf|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|zip|gz|wasm)$/i;

/** Legacy .html (and matching bare stubs) → /shiraz KEEP. One hop only. */
const HTML_TO_KEEP: Record<string, string> = {
  '/articles/skin-rejuvenation-guide.html': '/articles/botox-filler-guide.html',
  '/laser-hair.html': '/shiraz/laser-hair-removal',
  '/skin-rejuvenation.html': '/shiraz/skin-rejuvenation',
  '/slimming.html': '/shiraz/slimming',
  '/injection.html': '/shiraz/injectables',
  '/hair-transplant.html': '/shiraz/hair-transplant',
  '/cosmetic-surgery.html': '/shiraz/cosmetic-surgery',
  '/botox.html': '/shiraz/botox',
  '/facial.html': '/shiraz/facial',
  '/rhinoplasty.html': '/shiraz/rhinoplasty',
  '/lasik.html': '/shiraz/lasik',
  '/femto-lasik.html': '/shiraz/femto-lasik',
  '/prk.html': '/shiraz/prk',
  '/pharmacy.html': '/shiraz/pharmacy',
  '/light-therapy.html': '/shiraz/light-therapy',
};

const BARE_STUB_TO_KEEP: Record<string, string> = {
  '/articles/skin-rejuvenation-guide': '/articles/botox-filler-guide.html',
  '/laser-hair': '/shiraz/laser-hair-removal',
  '/skin-rejuvenation': '/shiraz/skin-rejuvenation',
  '/slimming': '/shiraz/slimming',
  '/injection': '/shiraz/injectables',
  '/hair-transplant': '/shiraz/hair-transplant',
  '/cosmetic-surgery': '/shiraz/cosmetic-surgery',
  '/botox': '/shiraz/botox',
  '/facial': '/shiraz/facial',
  '/rhinoplasty': '/shiraz/rhinoplasty',
  '/lasik': '/shiraz/lasik',
  '/femto-lasik': '/shiraz/femto-lasik',
  '/prk': '/shiraz/prk',
  '/pharmacy': '/shiraz/pharmacy',
  '/light-therapy': '/shiraz/light-therapy',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get(INTERNAL_HEADER) === '1') {
      return fetch(request);
    }

    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.endsWith('.html')) {
      const keep = HTML_TO_KEEP[pathname];
      if (keep) {
        return redirectTo(url, keep);
      }
      return redirectHtmlToClean(url);
    }

    const bare = pathname.replace(/\/+$/, '') || '/';
    if (BARE_STUB_TO_KEEP[bare]) {
      return redirectTo(url, BARE_STUB_TO_KEEP[bare]);
    }

    if (shouldPassthrough(pathname)) {
      return fetchOrigin(request);
    }

    if (isExtensionlessContentPath(pathname)) {
      const htmlPath = pathname.endsWith('/')
        ? `${pathname.slice(0, -1)}.html`
        : `${pathname}.html`;
      const htmlResponse = await fetchOriginPath(request, htmlPath);
      if (htmlResponse.ok) {
        return new Response(htmlResponse.body, htmlResponse);
      }
      // Forward origin 3xx (e.g. consolidated .html → /shiraz KEEP)
      if (htmlResponse.status >= 300 && htmlResponse.status < 400) {
        const loc = htmlResponse.headers.get('Location');
        if (loc) {
          return new Response(null, {
            status: htmlResponse.status,
            headers: { Location: loc },
          });
        }
      }
      return fetchOrigin(request);
    }

    return fetchOrigin(request);
  },
};

function redirectTo(url: URL, pathname: string): Response {
  const target = new URL(url.toString());
  target.pathname = pathname;
  target.search = url.search;
  return Response.redirect(target.toString(), 301);
}

function redirectHtmlToClean(url: URL): Response {
  let clean = url.pathname.slice(0, -'.html'.length);
  if (clean === '/index' || clean.endsWith('/index')) {
    clean = clean.slice(0, -'/index'.length) || '/';
  }
  if (!clean) clean = '/';
  return redirectTo(url, clean);
}

function shouldPassthrough(pathname: string): boolean {
  if (PASSTHROUGH_EXACT.has(pathname)) return true;
  if (PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (ASSET_EXT.test(pathname)) return true;
  return false;
}

function isExtensionlessContentPath(pathname: string): boolean {
  if (pathname === '/') return false;
  const last = pathname.split('/').pop() ?? '';
  if (last.includes('.')) return false;
  return true;
}

function withInternalHeader(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_HEADER, '1');
  return headers;
}

function fetchOrigin(request: Request): Promise<Response> {
  return fetch(
    new Request(request.url, {
      method: request.method,
      headers: withInternalHeader(request),
      body: request.body,
      redirect: 'manual',
    })
  );
}

function fetchOriginPath(request: Request, pathname: string): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = pathname;
  return fetch(
    new Request(url.toString(), {
      method: request.method,
      headers: withInternalHeader(request),
      body: request.body,
      redirect: 'manual',
    })
  );
}
