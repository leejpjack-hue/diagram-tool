import { parseDiagram } from '../parser/parser';
import type { ParsedDiagram } from '../store/types';

export type SkillNodeKind = 'start' | 'step' | 'decision' | 'end';
export interface SkillFlow {
  title: string;
  nodes: { id: string; kind: SkillNodeKind; label: string }[];
  edges: { from: string; to: string; label?: string }[];
}
export interface TypeToFlowResult {
  flow: SkillFlow;
  mermaid: string;
  warnings: string[];
}

/** Validate untrusted skill results before changing the local board. */
export function adaptTypeToFlow(value: unknown): { source: string; graph: ParsedDiagram; result: TypeToFlowResult } {
  if (!value || typeof value !== 'object') throw new Error('The skill returned an invalid result.');
  const result = value as TypeToFlowResult;
  const flow = result.flow;
  if (!flow || typeof flow.title !== 'string' || !flow.title.trim() || !Array.isArray(flow.nodes) || !flow.nodes.length || !Array.isArray(flow.edges) || typeof result.mermaid !== 'string' || !/^flowchart\s+TD\b/.test(result.mermaid) || !Array.isArray(result.warnings) || !result.warnings.every(warning => typeof warning === 'string')) {
    throw new Error('The skill returned an invalid flow envelope.');
  }
  const ids = new Set<string>();
  for (const node of flow.nodes) {
    if (!node || typeof node.id !== 'string' || !/^[a-z][a-z0-9]*$/.test(node.id) || ids.has(node.id) || !['start', 'step', 'decision', 'end'].includes(node.kind) || typeof node.label !== 'string' || !node.label.trim() || /[\r\n]/.test(node.label)) {
      throw new Error('The skill returned an invalid flow node.');
    }
    ids.add(node.id);
  }
  for (const edge of flow.edges) {
    if (!edge || !ids.has(edge.from) || !ids.has(edge.to) || (edge.label !== undefined && (typeof edge.label !== 'string' || /[\r\n]/.test(edge.label)))) {
      throw new Error('The skill returned an invalid flow edge.');
    }
  }
  for (const node of flow.nodes.filter(item => item.kind === 'decision')) {
    const outgoing = flow.edges.filter(edge => edge.from === node.id);
    if (outgoing.length < 2 || outgoing.some(edge => !edge.label?.trim())) {
      throw new Error('Each decision needs at least two labeled outgoing edges.');
    }
  }
  if (/[\r\n]/.test(flow.title)) throw new Error('The skill returned an invalid title.');

  // Native DSL is the board's durable source of truth. Escape quotes so labels
  // survive a reload and subsequent canvas edits without changing IDs or edges.
  const quoted = (text: string) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const lines = ['diagram: flow', `title: ${quoted(flow.title)}`, 'direction: TB', ''];
  for (const node of flow.nodes) {
    if (node.kind === 'start' || node.kind === 'end') lines.push(`${node.kind} ${node.id}`);
  }
  lines.push('');
  for (const edge of flow.edges) lines.push(`${edge.from} ->${edge.label ? `|${quoted(edge.label)}|` : ''} ${edge.to}`);
  lines.push('');
  for (const node of flow.nodes) {
    lines.push(`node ${node.id} {`, `  label: ${quoted(node.label)}`);
    if (node.kind === 'step') lines.push('  type: process');
    if (node.kind === 'decision') lines.push('  type: decision');
    lines.push('}', '');
  }
  const source = lines.join('\n');
  return { source, graph: parseDiagram(source), result };
}
