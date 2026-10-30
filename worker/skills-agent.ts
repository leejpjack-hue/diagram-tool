import { Workspace } from '@cloudflare/computer';
import { Think, skills } from '@cloudflare/think';
import { loadSkillCatalog } from 'agents/skills';
import { STARTER_SKILLS } from './generated-skill-seed';
// Free-plan deploy: no Dynamic Workers / worker_loaders. Run the checked-in converter
// via static import instead of WorkerJavaScriptBackend + LOADER.
import typeToFlow from '../skills/type-to-flow/scripts/type-to-flow.js';

const ROOT = '/workspace/.agents/skills';
const SEEDED = 'dt-skills-seeded-v1';
const MAX_INPUT_BYTES = 64 * 1024;

type Env = Cloudflare.Env;

/** Durable skills host: Workspace files stay authoritative for catalog/activation. */
export class DiagramSkillsAgent extends Think<Env> {
  // File storage only — no JS Worker Loader backend (paid Dynamic Workers).
  override workspace = new Workspace({
    storage: this.ctx.storage,
  });

  override getSkills() {
    return [skills.workspace(this.workspace)];
  }

  override async onStart() {
    if (await this.ctx.storage.get(SEEDED)) return;
    for (const [relative, content] of Object.entries(STARTER_SKILLS)) {
      const file = `${ROOT}/${relative}`;
      let exists = true;
      try {
        await this.workspace.fs.stat(file);
      } catch (error) {
        if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error;
        exists = false;
      }
      if (!exists) {
        await this.workspace.fs.mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
        await this.workspace.fs.writeFile(file, content);
      }
    }
    await this.ctx.storage.put(SEEDED, true);
  }

  override async onRequest(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (path === '/api/skills' && request.method === 'GET') {
        const catalog = await loadSkillCatalog(await this.getSkills());
        return Response.json({ skills: catalog.skills.map(({ skill, location }) => ({ name: skill.name, description: skill.description, location })) });
      }
      if (path === '/api/skills/files' && request.method === 'PUT') {
        // Only the outer Worker can forward an authorized administration request.
        const body = await request.json() as { path?: unknown; content?: unknown };
        if (typeof body.path !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*\/(?:SKILL\.md|(?:scripts|references|assets)\/[a-zA-Z0-9_.\/-]+)$/.test(body.path) || body.path.split('/').some(part => part === '.' || part === '..') || typeof body.content !== 'string' || new TextEncoder().encode(body.content).byteLength > 256 * 1024) {
          return Response.json({ error: 'Invalid skill path or content.' }, { status: 400 });
        }
        const file = `${ROOT}/${body.path}`;
        await this.workspace.fs.mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
        await this.workspace.fs.writeFile(file, body.content);
        return Response.json({ path: file });
      }
      const activation = /^\/api\/skills\/([a-z0-9-]+)\/activate$/.exec(path);
      if (activation && request.method === 'POST') {
        const catalog = await loadSkillCatalog(await this.getSkills());
        const activated = catalog.activate(activation[1]);
        if (!activated.ok) return Response.json({ error: 'Skill not found.' }, { status: 404 });
        return Response.json({ content: activated.value });
      }
      if (path === '/api/skills/type-to-flow/run' && request.method === 'POST') {
        if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
          return Response.json({ error: 'Expected JSON input.' }, { status: 415 });
        }
        const raw = await request.text();
        if (new TextEncoder().encode(raw).byteLength > MAX_INPUT_BYTES) return Response.json({ error: 'Workflow is too large.' }, { status: 413 });
        let input: { text?: unknown; title?: unknown };
        try { input = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid JSON input.' }, { status: 400 }); }
        if (!input || typeof input.text !== 'string' || !input.text.trim() || (input.title !== undefined && typeof input.title !== 'string')) {
          return Response.json({ error: 'Provide workflow text and an optional title.' }, { status: 400 });
        }
        const catalog = await loadSkillCatalog(await this.getSkills());
        const activated = catalog.activate('type-to-flow');
        if (!activated.ok) return Response.json({ error: 'type-to-flow skill is unavailable.' }, { status: 503 });
        // Static import (free plan). Editable Workspace scripts remain for catalog/activation;
        // live JS Worker Loader execution requires paid Dynamic Workers.
        try {
          const value = await typeToFlow({
            text: input.text,
            ...(typeof input.title === 'string' ? { title: input.title } : {}),
          });
          return Response.json(value);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The type-to-flow skill could not run.';
          const status = /enter at least one|must be a string/i.test(message) ? 400 : 500;
          return Response.json({ error: message }, { status });
        }
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Skills workspace request failed', error instanceof Error ? error.message : 'unknown error');
      return Response.json({ error: 'The skills workspace is unavailable.' }, { status: 500 });
    }
  }
}
