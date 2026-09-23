// DT-AI-05 — board → Type-steps plain text (local only, no LLM).
//
// Walk choice: Kahn topological order over flow nodes (roots = in-degree 0,
// tie-break by first appearance in `diagram.nodes`). If a cycle remains
// (e.g. retry loops), remaining nodes are appended in first-edge-appearance
// order. Decision nodes with Yes/No outs emit `If …` / `then …` / `else …`
// when those branch targets have not yet been listed; otherwise every flow
// node is one line. Role chips round-trip as `Human:` / `Model:` / `Tool:` /
// `Check:` prefixes (same vocabulary as DT-AI-04).

import type { FlowNode, FlowNodeRole, ParsedDiagram } from '../store/types';

const ROLE_WORD: Record<FlowNodeRole, string> = {
  human: 'Human',
  model: 'Model',
  tool: 'Tool',
  check: 'Check',
};

function flowNodes(diagram: ParsedDiagram): FlowNode[] {
  return diagram.nodes.filter((n): n is FlowNode => n.type === 'flow');
}

function nodeLabel(n: FlowNode): string {
  return (n.properties.label || n.name || n.id).trim() || n.id;
}

function formatStep(n: FlowNode): string {
  const label = nodeLabel(n);
  const role = n.properties.role;
  if (role && ROLE_WORD[role]) return `${ROLE_WORD[role]}: ${label}`;
  return label;
}

function nodeIsDecision(n: FlowNode): boolean {
  return n.properties.nodeType === 'decision';
}

/**
 * Convert a parsed flow diagram into one-step-per-line Type steps text.
 * Throws a teachable Error when there is nothing to copy.
 */
export function flowToPlainSteps(diagram: ParsedDiagram): string {
  if (diagram.mode !== 'flow') {
    throw new Error('Copy as steps works on Flow boards. Switch to Flow, then try again.');
  }

  const nodes = flowNodes(diagram);
  if (nodes.length === 0) {
    throw new Error('No steps on this board yet. Add a few nodes, or use Type steps to build one.');
  }

  const byId = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map<string, { to: string; label?: string }[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    outgoing.set(n.id, []);
    indeg.set(n.id, 0);
  }

  const edgeOrder: { from: string; to: string; label?: string }[] = [];
  for (const e of diagram.edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    outgoing.get(e.from)!.push({ to: e.to, label: e.label });
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    edgeOrder.push({ from: e.from, to: e.to, label: e.label });
  }

  // Kahn topological order; stable by original node list order.
  const queue: string[] = [];
  for (const n of nodes) {
    if ((indeg.get(n.id) ?? 0) === 0) queue.push(n.id);
  }
  const order: string[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const edge of outgoing.get(id) ?? []) {
      const next = (indeg.get(edge.to) ?? 0) - 1;
      indeg.set(edge.to, next);
      if (next === 0) queue.push(edge.to);
    }
  }
  // Cycle remainder: first appearance via edge walk, then leftover nodes.
  if (order.length < nodes.length) {
    for (const e of edgeOrder) {
      if (!seen.has(e.from)) {
        seen.add(e.from);
        order.push(e.from);
      }
      if (!seen.has(e.to)) {
        seen.add(e.to);
        order.push(e.to);
      }
    }
    for (const n of nodes) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        order.push(n.id);
      }
    }
  }

  const lines: string[] = [];
  const emitted = new Set<string>();

  for (const id of order) {
    if (emitted.has(id)) continue;
    const n = byId.get(id);
    if (!n) continue;

    if (nodeIsDecision(n)) {
      const outs = outgoing.get(id) ?? [];
      const yes = outs.find(o => (o.label ?? '').toLowerCase() === 'yes');
      const no = outs.find(o => (o.label ?? '').toLowerCase() === 'no');
      // Also accept common AI-template labels ok/retry as Yes/No stand-ins when cheap.
      const ok = yes ?? outs.find(o => (o.label ?? '').toLowerCase() === 'ok');
      const retry = no ?? outs.find(o => (o.label ?? '').toLowerCase() === 'retry');
      const yesEdge = yes ?? ok;
      const noEdge = no ?? retry;

      if (yesEdge || noEdge) {
        lines.push(`If ${formatStep(n)}`);
        emitted.add(id);
        if (yesEdge) {
          const yt = byId.get(yesEdge.to);
          if (yt) {
            lines.push(`then ${formatStep(yt)}`);
            emitted.add(yt.id);
          }
        }
        if (noEdge) {
          const nt = byId.get(noEdge.to);
          if (nt) {
            lines.push(`else ${formatStep(nt)}`);
            emitted.add(nt.id);
          }
        }
        continue;
      }
    }

    lines.push(formatStep(n));
    emitted.add(id);
  }

  if (lines.length === 0) {
    throw new Error('No steps on this board yet. Add a few nodes, or use Type steps to build one.');
  }
  return lines.join('\n');
}
