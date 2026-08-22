#!/usr/bin/env node
// MCP server for the diagram-tool DSL. Speaks JSON-RPC over stdio so any
// MCP-compatible client (opencode, claude code, Claude Desktop, ...) can
// author, edit, verify, and export diagrams declaratively.
//
// Run via tsx (dev) or compiled (production):
//   tsx src/server.ts
//   node dist/server.js

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  parseDiagram,
  verifyDiagram,
  summarizeDiagram,
  TEMPLATES,
  addNodeToDSL,
  removeNodeFromDSL,
  addConnectionDSL,
  setReverseDSL,
  setReverseMermaidDSL,
  exportDiagram,
} from './diagram.js';

const server = new McpServer({
  name: 'diagram-tool',
  version: '0.1.0',
});

// ----------------------------------------------------------------------------
// Tools
// ----------------------------------------------------------------------------

server.registerTool(
  'verify_diagram',
  {
    description:
      'Validate a diagram DSL string. Returns structured errors, warnings, ' +
      'and a summary (nodes/edges/groups/lanes/annotations, broken edges). ' +
      'Use this after any edit before exporting or rendering.',
    inputSchema: {
      dsl: z.string().describe('The DSL text to validate. Accepts native diagram-tool DSL or Mermaid flowchart syntax.'),
    },
  },
  async ({ dsl }) => {
    const result = verifyDiagram(dsl);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.registerTool(
  'list_templates',
  {
    description: 'List available diagram templates. Templates are starting points — load one and edit it.',
    inputSchema: {
      category: z.enum(['Architecture', 'Flow', 'Sequence', 'Gantt', 'Workshop']).optional()
        .describe('Optional category filter.'),
    },
  },
  async ({ category }) => {
    const items = category ? TEMPLATES.filter(t => t.category === category) : TEMPLATES;
    const summary = items.map(t => ({
      id: t.id,
      name: t.name,
      category: t.category,
      mode: t.mode,
      description: t.description,
      tags: t.tags,
    }));
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  },
);

server.registerTool(
  'load_template',
  {
    description: 'Load a template by id and return its DSL.',
    inputSchema: {
      id: z.string().describe('The template id from list_templates.'),
    },
  },
  async ({ id }) => {
    const tpl = TEMPLATES.find(t => t.id === id);
    if (!tpl) {
      return { isError: true, content: [{ type: 'text', text: `Template not found: ${id}` }] };
    }
    return { content: [{ type: 'text', text: tpl.dsl }] };
  },
);

server.registerTool(
  'new_diagram',
  {
    description: 'Create a fresh diagram DSL string. Optionally seed it from a template.',
    inputSchema: {
      mode: z.enum(['architecture', 'flow']).describe('Diagram mode.'),
      title: z.string().optional().describe('Diagram title.'),
      direction: z.enum(['TB', 'LR']).optional().describe('Layout direction. Default TB.'),
      templateId: z.string().optional().describe('Optional template id to seed from.'),
    },
  },
  async ({ mode, title, direction, templateId }) => {
    let dsl: string;
    if (templateId) {
      const tpl = TEMPLATES.find(t => t.id === templateId);
      if (!tpl) {
        return { isError: true, content: [{ type: 'text', text: `Template not found: ${templateId}` }] };
      }
      dsl = tpl.dsl;
    } else {
      const lines = [`diagram: ${mode}`];
      if (title) lines.push(`title: ${title}`);
      if (direction) lines.push(`direction: ${direction}`);
      dsl = lines.join('\n');
    }
    const verify = verifyDiagram(dsl);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'add_node',
  {
    description: 'Append a node to a DSL string. Supports architecture (service/database/queue/cloud/class), flow (node), and annotation (note) shapes.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      kind: z.enum(['service', 'database', 'queue', 'cloud', 'class', 'node', 'annotation'])
        .describe('Node kind / shape.'),
      name: z.string().describe('Node name. Used as the id too.'),
      properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Property bag: tech, type, color, icon, topic, label, text, at, etc.'),
    },
  },
  async ({ dsl, kind, name, properties }) => {
    const { dsl: updated, created } = addNodeToDSL(dsl, { kind, name, properties });
    if (!created) {
      return { isError: true, content: [{ type: 'text', text: `Could not create node "${name}".` }] };
    }
    const verify = verifyDiagram(updated);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl: updated, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'remove_node',
  {
    description: 'Remove a node and every edge / lane / group reference to it from the DSL.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      name: z.string().describe('Node name (id) to remove.'),
    },
  },
  async ({ dsl, name }) => {
    const updated = removeNodeFromDSL(dsl, name);
    const verify = verifyDiagram(updated);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl: updated, removed: name, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'add_edge',
  {
    description: 'Connect two existing nodes. Architecture appends to the source block; flow adds a standalone `A -> B` line.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      from: z.string().describe('Source node name.'),
      to: z.string().describe('Target node name.'),
      label: z.string().optional()
        .describe('Optional edge label (flow mode), e.g. "Yes" or "REST".'),
    },
  },
  async ({ dsl, from, to, label }) => {
    const mode = (() => {
      try {
        return parseDiagram(dsl).mode as 'architecture' | 'flow' | 'sequence' | 'gantt';
      } catch {
        return 'architecture';
      }
    })();
    let updated: string | null;
    if (mode === 'flow' && label) {
      updated = `${dsl.replace(/\s+$/, '')}\n${from} ->|${label}| ${to}\n`;
    } else {
      updated = addConnectionDSL(dsl, mode === 'flow' ? 'flow' : 'architecture', from, to);
    }
    if (updated === null) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Could not add edge: either "${from}" block was not found or the connection already exists.` }],
      };
    }
    const verify = verifyDiagram(updated);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl: updated, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'label_edge',
  {
    description: 'Attach a label to a specific architecture connection (REST / dynamic / consume). Idempotent — does not duplicate the edge.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      from: z.string().describe('Source node name.'),
      to: z.string().describe('Target node name.'),
      label: z.string().describe('Edge label text.'),
    },
  },
  async ({ dsl, from, to, label }) => {
    const updated = `${dsl.replace(/\s+$/, '')}\n\nedge ${from} -> ${to} { label: "${label}" }\n`;
    const verify = verifyDiagram(updated);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl: updated, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'set_reverse',
  {
    description:
      "Toggle a flow node's input/output direction flip. For native DSL writes " +
      '`reverse: true|false`; for Mermaid-format flowcharts uses a `%% reverse <id>` ' +
      'comment so the change survives re-transpilation.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      node: z.string().describe('Node name (id).'),
      reversed: z.boolean().describe('true to flip, false to clear.'),
    },
  },
  async ({ dsl, node, reversed }) => {
    const updated = setReverseMermaidDSL(dsl, node, reversed) ?? setReverseDSL(dsl, node, reversed);
    if (updated === null) {
      return { isError: true, content: [{ type: 'text', text: `Could not update reverse flag for "${node}".` }] };
    }
    const verify = verifyDiagram(updated);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ dsl: updated, verify }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'export_diagram',
  {
    description: 'Render a parsed diagram in the requested format. Useful for handing a diagram to other tools.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
      format: z.enum(['json', 'csv', 'mermaid', 'summary']).describe('Output format.'),
    },
  },
  async ({ dsl, format }) => {
    try {
      const parsed = parseDiagram(dsl);
      const output = exportDiagram(parsed, { format });
      return { content: [{ type: 'text', text: output }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: msg }] };
    }
  },
);

server.registerTool(
  'get_info',
  {
    description: 'Get a parsed summary (counts and lists) for the DSL. Cheaper than re-parsing for big diagrams.',
    inputSchema: {
      dsl: z.string().describe('Current DSL.'),
    },
  },
  async ({ dsl }) => {
    try {
      const parsed = parseDiagram(dsl);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...summarizeDiagram(parsed),
            nodesByName: parsed.nodes.map(n => ({ id: n.id, type: n.type, name: n.name })),
            edges: parsed.edges.map(e => ({ from: e.from, to: e.to, label: e.label })),
          }, null, 2),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: 'text', text: msg }] };
    }
  },
);

// ----------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[diagram-tool-mcp] server ready');
}

main().catch(err => {
  console.error('[diagram-tool-mcp] fatal:', err);
  process.exit(1);
});
