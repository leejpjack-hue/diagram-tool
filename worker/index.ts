import { DiagramSkillsAgent } from './skills-agent';
export { DiagramSkillsAgent };

export interface Env {
  ASSETS?: { fetch: typeof fetch };
  DIAGRAM_SKILLS: DurableObjectNamespace<DiagramSkillsAgent>;
  SKILLS_ADMIN_TOKEN?: string;
}

const GOOGLE_SITE_VERIFICATION_PATH = '/google64b6c4e267d551f7.html';
const GOOGLE_SITE_VERIFICATION_BODY = 'google-site-verification: google64b6c4e267d551f7.html\n';

// Compare fixed-size digests so an invalid token cannot authorize a file write.
async function authorized(request: Request, token?: string): Promise<boolean> {
  if (!token) return false;
  const supplied = request.headers.get('authorization');
  if (!supplied?.startsWith('Bearer ')) return false;
  const encoder = new TextEncoder();
  const [expected, actual] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(token)),
    crypto.subtle.digest('SHA-256', encoder.encode(supplied.slice(7))),
  ]);
  let mismatch = 0;
  const actualBytes = new Uint8Array(actual);
  for (const [index, byte] of new Uint8Array(expected).entries()) mismatch |= byte ^ actualBytes[index];
  return mismatch === 0;
}

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

    // Only these narrow routes reach the agent; its general chat, filesystem,
    // and execution interfaces are not exposed on the public Worker.
    if (url.pathname === '/api/skills' || url.pathname.startsWith('/api/skills/')) {
      if (url.pathname === '/api/skills/files' && !(await authorized(request, env.SKILLS_ADMIN_TOKEN))) {
        return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: { 'cache-control': 'no-store' } });
      }
      const id = env.DIAGRAM_SKILLS.idFromName('diagram-tool-skills');
      const response = await env.DIAGRAM_SKILLS.get(id).fetch(request);
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'no-store');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    // Do not hand other API paths to the asset SPA fallback.
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
