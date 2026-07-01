// Smoke test: spawn the server over stdio and exercise the basic tools.
// Run with `tsx src/server.test.ts`.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = `${here}/server.ts`;

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: any;
}

class StdioClient {
  private proc: ReturnType<typeof spawn>;
  private buffer = '';
  private nextId = 1;
  private resolvers = new Map<number, (msg: any) => void>();

  constructor() {
    this.proc = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => this.handle(chunk));
  }

  private handle(chunk: string) {
    this.buffer += chunk;
    let nl;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (typeof msg.id === 'number' && this.resolvers.has(msg.id)) {
          this.resolvers.get(msg.id)!(msg);
          this.resolvers.delete(msg.id);
        }
      } catch {
        // ignore non-JSON stdout lines (server logs)
      }
    }
  }

  async request(method: string, params: any): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return new Promise(resolve => {
      this.resolvers.set(id, resolve);
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  close() {
    this.proc.kill();
  }
}

async function main() {
  const client = new StdioClient();

  // 1. Initialize
  const init = await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke-test', version: '0.0.1' },
  });
  console.log('initialize:', init.result ? 'OK' : 'FAIL');

  // 2. List tools
  const list = await client.request('tools/list', {});
  const tools = list.result?.tools ?? [];
  console.log('tools/list:', tools.length, 'tools registered:', tools.map((t: any) => t.name).join(', '));

  // 3. list_templates
  const tpls: any = await client.callTool('list_templates', {});
  const parsedTpls = JSON.parse(tpls.result.content[0].text);
  console.log('list_templates:', parsedTpls.length, 'templates');

  // 4. load_template
  const templ: any = await client.callTool('load_template', { id: parsedTpls[0].id });
  const dsl = templ.result.content[0].text;
  console.log('load_template: returned', dsl.length, 'chars of DSL');

  // 5. verify_diagram (valid)
  const valid: any = await client.callTool('verify_diagram', { dsl });
  const validResult = JSON.parse(valid.result.content[0].text);
  console.log('verify_diagram (valid):', validResult.valid, '|', validResult.summary.nodes, 'nodes');

  // 6. verify_diagram (broken)
  const brokenDsl = 'service Foo {\n  type: badType\n}\n';
  const invalid: any = await client.callTool('verify_diagram', { dsl: brokenDsl });
  const invalidResult = JSON.parse(invalid.result.content[0].text);
  console.log('verify_diagram (broken):', invalidResult.valid, '| errors:', invalidResult.errors.length);

  // 7. add_node
  const addRes: any = await client.callTool('add_node', {
    dsl: 'diagram: architecture\n',
    kind: 'cloud',
    name: 'CDN',
    properties: { provider: 'aws', kind: 'cloudfront', color: '#f97316' },
  });
  const addResult = JSON.parse(addRes.result.content[0].text);
  console.log('add_node: valid =', addResult.verify.valid, '| summary:', JSON.stringify(addResult.verify.summary));

  // 8. add_edge then verify
  const nodeDsl = `diagram: architecture
service Frontend {
  type: api
}
service Backend {
  type: microservice
}
`;
  const edgeRes: any = await client.callTool('add_edge', {
    dsl: nodeDsl,
    from: 'Frontend',
    to: 'Backend',
  });
  const edgeResult = JSON.parse(edgeRes.result.content[0].text);
  console.log('add_edge: valid =', edgeResult.verify.valid, '| edges =', edgeResult.verify.summary.edges);

  // 9. label_edge
  const labelRes: any = await client.callTool('label_edge', {
    dsl: nodeDsl,
    from: 'Frontend',
    to: 'Backend',
    label: 'REST',
  });
  const labelResult = JSON.parse(labelRes.result.content[0].text);
  console.log('label_edge: valid =', labelResult.verify.valid, '| labelled edges =',
    labelResult.verify.summary.edges, '(should be 1)');
  const hasRest = labelResult.dsl.includes('REST');
  console.log('label_edge: DSL contains "REST" =', hasRest);

  // 10. export_diagram (summary)
  const exportRes: any = await client.callTool('export_diagram', {
    dsl,
    format: 'summary',
  });
  const summary = exportRes.result.content[0].text;
  console.log('export_diagram (summary): length', summary.length, 'first line =', summary.split('\n')[0]);

  // 11. get_info
  const infoRes: any = await client.callTool('get_info', { dsl });
  const info = JSON.parse(infoRes.result.content[0].text);
  console.log('get_info:', info.summary);

  // 12. set_reverse
  const flowDsl = `diagram: flow
direction: LR
A -> B
node B {
  label: B
}
`;
  const reverseRes: any = await client.callTool('set_reverse', {
    dsl: flowDsl,
    node: 'B',
    reversed: true,
  });
  const reverseResult = JSON.parse(reverseRes.result.content[0].text);
  console.log('set_reverse: valid =', reverseResult.verify.valid, '| contains reverse =',
    reverseResult.dsl.includes('reverse: true'));

  client.close();
  console.log('\n[smoke] all calls completed');
}

main().catch(err => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});
