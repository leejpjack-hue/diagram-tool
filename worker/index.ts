export interface Env {
  ASSETS?: { fetch: typeof fetch };
}

const GOOGLE_SITE_VERIFICATION_PATH = '/google64b6c4e267d551f7.html';
const GOOGLE_SITE_VERIFICATION_BODY = 'google-site-verification: google64b6c4e267d551f7.html\n';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // GSC HTML-file verification requires HTTP 200 at the exact .html URL.
    // Workers assets html_handling auto-trailing-slash would 307 to the slashless path.
    if (url.pathname === GOOGLE_SITE_VERIFICATION_PATH) {
      return new Response(GOOGLE_SITE_VERIFICATION_BODY, {
        status: 200,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=0, must-revalidate',
        },
      });
    }

    // run_worker_first sends /api/* here. With the signup route gone, do not
    // hand those paths to the asset SPA fallback.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    }

    if (url.pathname === '/app') {
      url.pathname = '/app/';
      request = new Request(url, request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404 });
  },
};
