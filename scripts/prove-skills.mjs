import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const scratch = await mkdtemp(join(tmpdir(), 'dt-skills-proof-'));
const configPath = join(root, `.wrangler-skills-proof-${process.pid}.json`);
const token = 'local-proof-only';
const port = Number(process.env.DT_SKILLS_PROOF_PORT || 18787);
const origin = `http://127.0.0.1:${port}`;
const config = JSON.parse((await readFile(join(root, 'wrangler.jsonc'), 'utf8')).replace(/^\s*\/\/.*$/gm, ''));
delete config.build;
delete config.assets;
await writeFile(configPath, JSON.stringify(config));
let output = '';
let server;
let exited = true;
async function startServer() {
  server = spawn(join(root, 'node_modules/.bin/wrangler'), [
    'dev', '--local', '--config', configPath, '--ip', '127.0.0.1', '--port', String(port),
    '--persist-to', scratch, '--var', `SKILLS_ADMIN_TOKEN:${token}`,
  ], { cwd: root, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  exited = false;
  server.stdout.on('data', chunk => { output += chunk; if (process.env.DT_SKILLS_VERBOSE) process.stdout.write(chunk); });
  server.stderr.on('data', chunk => { output += chunk; if (process.env.DT_SKILLS_VERBOSE) process.stderr.write(chunk); });
  server.on('exit', () => { exited = true; });
  server.on('error', error => { output += error.message; exited = true; });
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline && !exited) {
    try {
      await fetch(`${origin}/`, { signal: AbortSignal.timeout(5_000) });
      return;
    } catch { /* starting */ }
    await delay(500);
  }
  throw new Error(`Local Worker did not start:\n${output}`);
}

async function stopServer() {
  if (exited) return;
  try {
    if (process.platform === 'win32') server.kill('SIGTERM');
    else process.kill(-server.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await new Promise(resolveExit => { if (exited) resolveExit(); else server.once('exit', resolveExit); });
}
const request = async (path, init) => {
  const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(90_000) });
  const raw = await response.text();
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${raw}`);
  return JSON.parse(raw);
};
try {
  await startServer();
  const catalog = await request('/api/skills');
  assert.ok(catalog.skills.some(skill => skill.name === 'type-to-flow' && skill.description && skill.location === '/workspace/.agents/skills/type-to-flow'));
  const activation = await request('/api/skills/type-to-flow/activate', { method: 'POST' });
  assert.match(activation.content, /read_skill_resource/);
  assert.match(activation.content, /scripts\/type-to-flow\.js/);
  const input = JSON.parse(await readFile(join(root, 'fixtures/type-to-flow/input.json'), 'utf8'));
  const expected = JSON.parse(await readFile(join(root, 'fixtures/type-to-flow/spike-output.json'), 'utf8'));
  const result = await request('/api/skills/type-to-flow/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  assert.deepEqual(result.flow, expected.flow);
  assert.match(result.mermaid, /^flowchart TD\n/);
  const forbidden = await fetch(`${origin}/api/skills/files`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(forbidden.status, 401);
  const putFile = (path, content) => request('/api/skills/files', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ path, content }) });
  await putFile('proof-added/SKILL.md', '---\nname: proof-added\ndescription: Test dynamic workspace discovery.\n---\n\nFirst body.\n');
  assert.ok((await request('/api/skills')).skills.some(skill => skill.name === 'proof-added'));
  assert.match((await request('/api/skills/proof-added/activate', { method: 'POST' })).content, /First body/);
  await putFile('proof-added/SKILL.md', '---\nname: proof-added\ndescription: Test dynamic workspace discovery.\n---\n\nUpdated body.\n');
  assert.match((await request('/api/skills/proof-added/activate', { method: 'POST' })).content, /Updated body/);

  // Free-plan path: run uses the statically imported converter (no Dynamic
  // Workers / LOADER). Script file edits still persist for catalog/activation.
  await putFile('type-to-flow/scripts/type-to-flow.js', '// edited converter retained in durable Workspace\n');
  assert.equal((await fetch(`${origin}/api/skills/missing/activate`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${origin}/api/skills/type-to-flow/run`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '' }) })).status, 400);
  const afterEdit = await request('/api/skills/type-to-flow/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  assert.deepEqual(afterEdit.flow, expected.flow);

  // A cold process with the same durable storage must keep operator SKILL edits.
  await stopServer();
  await startServer();
  assert.match((await request('/api/skills/proof-added/activate', { method: 'POST' })).content, /Updated body/);
  const restored = await request('/api/skills/type-to-flow/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  assert.deepEqual(restored.flow, expected.flow);
  console.log(`PROOF_OK=1 Workspace catalog, activation, static type-to-flow exec (${result.flow.nodes.length} nodes / ${result.flow.edges.length} edges), authenticated add/edit, durable SKILL edits survive restart (no Dynamic Workers)`);
} catch (error) {
  console.error(output.slice(-6000));
  throw error;
} finally {
  await stopServer();
  await rm(configPath, { force: true });
  await rm(scratch, { force: true, recursive: true });
}
