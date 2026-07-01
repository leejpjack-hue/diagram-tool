// Thin DSL helpers shared by the MCP server's tools. Re-exports the project's
// parser so each tool can speak the same parsed shape, and adds the few
// additional mutation primitives (add_node, remove_node, etc.) the MCP tools
// expose to AI agents.

import { parseDiagram } from '../../src/parser/index.js';
import { isMermaidFlow, mermaidFlowToDSL } from '../../src/parser/mermaidFlow.js';
import { addConnectionDSL } from '../../src/utils/connectDSL.js';
import { setReverseDSL, setReverseMermaidDSL } from '../../src/utils/flowDSL.js';
import type { ParsedDiagram } from '../../src/store/types.js';
import { TEMPLATES } from '../../src/components/TemplatePicker/templates.js';
import type { DiagramTemplate } from '../../src/components/TemplatePicker/templates.js';

export type { ParsedDiagram };
export { parseDiagram, isMermaidFlow, mermaidFlowToDSL };
export { TEMPLATES };
export type { DiagramTemplate };

export interface VerifyResult {
  valid: boolean;
  errors: { line: number; column: number; message: string }[];
  warnings: string[];
  summary: {
    mode: string;
    title: string;
    nodes: number;
    edges: number;
    groups: number;
    lanes: number;
    annotations: number;
    nodesByType: Record<string, number>;
  };
}

export function verifyDiagram(dsl: string): VerifyResult {
  try {
    const parsed = parseDiagram(dsl);
    const summary = summarizeDiagram(parsed);
    return {
      valid: true,
      errors: [],
      warnings: extractWarnings(parsed),
      summary,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      errors: parseError(msg),
      warnings: [],
      summary: emptySummary(),
    };
  }
}

export function summarizeDiagram(d: ParsedDiagram): VerifyResult['summary'] {
  const nodesByType: Record<string, number> = {};
  for (const n of d.nodes) {
    nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
  }
  return {
    mode: d.mode,
    title: d.title,
    nodes: d.nodes.length,
    edges: d.edges.length,
    groups: d.groups.length,
    lanes: d.lanes?.length ?? 0,
    annotations: nodesByType['annotation'] ?? 0,
    nodesByType,
  };
}

function emptySummary(): VerifyResult['summary'] {
  return {
    mode: 'unknown', title: '', nodes: 0, edges: 0, groups: 0, lanes: 0,
    annotations: 0, nodesByType: {},
  };
}

function extractWarnings(d: ParsedDiagram): string[] {
  const w: string[] = [];
  const ids = new Set(d.nodes.map(n => n.id));
  for (const e of d.edges) {
    if (!ids.has(e.from)) w.push(`Edge from "${e.from}" references unknown node`);
    if (!ids.has(e.to)) w.push(`Edge to "${e.to}" references unknown node`);
  }
  for (const g of d.groups) {
    const missing = g.contains.filter(id => !ids.has(id));
    if (missing.length) w.push(`Group "${g.name}" references unknown member(s): ${missing.join(', ')}`);
  }
  return w;
}

// Parse the parser's "Expected X but got Y at line L, column C" error
// message into structured fields. Falls back to a single line-1 error if
// the format doesn't match.
function parseError(msg: string): VerifyResult['errors'] {
  const m = /at line (\d+), column (\d+)/.exec(msg);
  if (!m) return [{ line: 1, column: 1, message: msg }];
  const line = Number(m[1]);
  const column = Number(m[2]);
  return [{ line, column, message: msg.split(' at line ')[0] }];
}

// ---- Mutation helpers ----

export interface NodeSpec {
  /** The shape kind. One of service/database/queue/cloud/class/node/annotation. */
  kind: string;
  name: string;
  /** Body fields like `tech`, `type`, `color`, `icon`, `text`, etc. */
  properties?: Record<string, string | number | boolean>;
}

export function addNodeToDSL(dsl: string, spec: NodeSpec): { dsl: string; created: boolean } {
  const block = renderNodeBlock(spec);
  if (block === null) return { dsl, created: false };
  return { dsl: `${dsl.replace(/\s+$/, '')}\n\n${block}\n`, created: true };
}

function renderNodeBlock({ kind, name, properties = {} }: NodeSpec): string | null {
  if (!name) return null;
  const id = String(name).trim();
  const body = renderProperties(properties);
  if (kind === 'annotation') {
    // Annotation: `note "body text" { color: "#fbbf24", at: x, y }`.
    const text = String(properties.text ?? properties.label ?? 'Note');
    const attrs = Object.entries(properties)
      .filter(([k]) => k !== 'text' && k !== 'label' && k !== 'name' && k !== 'kind')
      .map(([k, v]) => renderValue(k, v)).filter(Boolean).join(', ');
    if (!attrs) return `note "${text}"`;
    return `note "${text}" {\n  ${attrs.replace(/, /g, '\n  ')}\n}`;
  }
  // Architecture / flow nodes: `<kind> <name> { <props> }`
  if (kind === 'flow') {
    return `node ${id} {\n  label: ${quoteIfNeeded(properties.label ?? id)}\n${body}\n}`;
  }
  return `${kind} ${id} {\n${body}\n}`;
}

function renderProperties(props: Record<string, unknown>): string {
  const skipped = new Set(['label', 'name', 'kind', 'text']);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (skipped.has(k)) continue;
    const line = renderValue(k, v);
    if (line) lines.push(`  ${line}`);
  }
  return lines.join('\n');
}

function renderValue(key: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return `${key}: ${value}`;
  if (typeof value === 'number') return `${key}: ${value}`;
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return null;
    // Already-quoted or special: pass through.
    if (/^["'].*["']$/.test(v)) return `${key}: ${v}`;
    // Numbers as strings
    if (/^-?\d+(\.\d+)?$/.test(v)) return `${key}: ${v}`;
    if (v.startsWith('#')) return `${key}: "${v}"`;
    if (v.includes(',') || v.includes(' ') || v.includes(':')) return `${key}: "${v}"`;
    return `${key}: ${v}`;
  }
  if (Array.isArray(value)) {
    return `${key}: ${value.join(', ')}`;
  }
  return `${key}: "${String(value)}"`;
}

function quoteIfNeeded(value: unknown): string {
  const v = String(value ?? '');
  if (v.includes(' ') || v.includes(':') || /^\d/.test(v)) return `"${v.replace(/"/g, "'")}"`;
  return v;
}

export function removeNodeFromDSL(dsl: string, nodeName: string): string {
  // Remove any `kind <name> { ... }` block for the named node.
  const id = String(nodeName).trim();
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let out = dsl.replace(
    new RegExp(`\\n*(?:service|database|queue|cloud|class|node|annotation)\\s+${esc}\\s*\\{[^}]*\\}\\s*\\n?`, 'g'),
    '\n',
  );
  // Drop any bare `start X` / `end X` references and any edges touching this id.
  out = out.replace(new RegExp(`\\n\\s*start\\s+${esc}\\b[^\n]*`, 'g'), '');
  out = out.replace(new RegExp(`\\n\\s*end\\s+${esc}\\b[^\n]*`, 'g'), '');
  out = out.replace(
    new RegExp(`\\s*\\b${esc}\\s*->\\s*[A-Za-z0-9_]+(\\s*\\|[^|]*\\|)?[^\\n]*`, 'g'),
    '',
  );
  out = out.replace(
    new RegExp(`\\s*[A-Za-z0-9_]+\\s*->\\s*${esc}(\\s*\\|[^|]*\\|)?[^\\n]*`, 'g'),
    '',
  );
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export { addConnectionDSL, setReverseDSL, setReverseMermaidDSL };

// ---- Export helpers ----

export interface ExportOptions {
  format: 'json' | 'csv' | 'summary' | 'mermaid';
}

export function exportDiagram(d: ParsedDiagram, options: ExportOptions): string {
  switch (options.format) {
    case 'json': return JSON.stringify(d, null, 2);
    case 'csv': return toCsv(d);
    case 'mermaid': return toMermaid(d);
    case 'summary': return toSummary(d);
  }
}

function toCsv(d: ParsedDiagram): string {
  const rows = [['type', 'id', 'name', 'color', 'meta']];
  for (const n of d.nodes) {
    const color = (n.properties as { color?: string }).color || '';
    const meta = collectMeta(n.properties);
    rows.push([n.type, n.id, n.name, color, meta]);
  }
  for (const e of d.edges) {
    rows.push(['edge', e.id, `${e.from} -> ${e.to}`, '', e.label || '']);
  }
  return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
}

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function collectMeta(props: Record<string, unknown>): string {
  const skip = new Set(['color', 'icon', 'label', 'lane']);
  return Object.entries(props)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => Array.isArray(v) ? `${k}=${v.join(',')}` : `${k}=${v}`)
    .join('; ');
}

function toSummary(d: ParsedDiagram): string {
  const s = summarizeDiagram(d);
  const lines = [
    `# ${s.title} (${s.mode})`,
    '',
    `- ${s.nodes} nodes (${Object.entries(s.nodesByType).map(([k, v]) => `${v} ${k}`).join(', ')})`,
    `- ${s.edges} edges`,
    `- ${s.groups} groups, ${s.lanes} lanes, ${s.annotations} annotations`,
    '',
    '## Nodes',
    ...d.nodes.map(n => `- **${n.name}** (${n.type}) — ${collectMeta(n.properties as Record<string, unknown>)}`),
  ];
  if (d.edges.length) {
    lines.push('', '## Edges', ...d.edges.map(e => `- ${e.from} -> ${e.to}${e.label ? ` *(${e.label})*` : ''}`));
  }
  return lines.join('\n');
}

function toMermaid(d: ParsedDiagram): string {
  const dir = d.direction === 'LR' ? 'LR' : 'TD';
  const lines = [`flowchart ${dir}`];
  const idMap = new Map(d.nodes.map(n => [n.id, sanitizeId(n.id)]));
  for (const n of d.nodes) {
    if (n.type === 'annotation') continue;
    const label = (n.properties as { label?: string }).label || n.name;
    lines.push(`  ${idMap.get(n.id)}["${label}"]`);
  }
  for (const e of d.edges) {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    if (!from || !to) continue;
    if (e.label) lines.push(`  ${from} -->|${e.label}| ${to}`);
    else lines.push(`  ${from} --> ${to}`);
  }
  return lines.join('\n');
}

function sanitizeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, '_');
}
