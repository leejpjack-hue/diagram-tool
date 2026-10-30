import { Workspace } from '@cloudflare/computer';
import { WorkerJavaScriptBackend } from '@cloudflare/computer/backends/worker-javascript';
import { Think, skills } from '@cloudflare/think';
import { loadSkillCatalog } from 'agents/skills';
import { STARTER_SKILLS } from './generated-skill-seed';

const ROOT = '/workspace/.agents/skills';
const SEEDED = 'dt-skills-seeded-v1';
const MAX_INPUT_BYTES = 64 * 1024;

type Env = Cloudflare.Env & { LOADER: WorkerLoader };

/** A real DT Durable Agent: the Workspace files remain authoritative after first boot. */
export class DiagramSkillsAgent extends Think<Env> {
  override workspace = new Workspace({
    storage: this.ctx.storage,
    backends: [new WorkerJavaScriptBackend({ id: 'js', loader: this.env.LOADER, access: 'read' })],
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
        // Invoke the live Workspace script, not an imported copy or an LLM.
        const handle = await this.workspace.runtime.exec('export { default } from "./scripts/type-to-flow.js";', {
          backend: 'js', cwd: `${ROOT}/type-to-flow`, input: { text: input.text, ...(typeof input.title === 'string' ? { title: input.title } : {}) }, encoding: 'utf8', timeoutMs: 10000,
        });
        const execution = await handle.result();
        // Completed execution records can contain the submitted prose. Drop
        // them after reading the result instead of keeping the SDK's default
        // retention window. Interrupted runs are still governed by the SDK.
        await this.workspace.runtime.disposeExec(handle.id, { backend: 'js' });
        if (execution.exitCode !== 0 || execution.status !== 'completed' || !execution.value) {
          return Response.json({ error: 'The type-to-flow skill could not run.' }, { status: 500 });
        }
        return Response.json(execution.value);
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Skills workspace request failed', error instanceof Error ? error.message : 'unknown error');
      return Response.json({ error: 'The skills workspace is unavailable.' }, { status: 500 });
    }
  }
}
