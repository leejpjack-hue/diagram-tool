/** Deterministic Workspace skill: one nonempty line per workflow node. */
export default async function typeToFlow(input = {}) {
  if (typeof input.text !== 'string' || !input.text.trim()) {
    throw new Error('Enter at least one workflow step.');
  }
  if (input.title != null && typeof input.title !== 'string') {
    throw new Error('Title must be a string.');
  }
  const title = input.title?.trim() || 'Untitled workflow';
  const lines = input.text.split(/\r?\n/)
    .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) throw new Error('Enter at least one workflow step.');

  const isDecision = text => /\?$/.test(text) || /^(if|when|whether)\b/i.test(text);
  const isEnd = text => /^(done|end|finish|complete|stop)\b/i.test(text) || /\b(done|finished)\.?$/i.test(text);
  const entries = lines.map((label, index) => ({
    label,
    kind: isDecision(label) ? 'decision' : index === 0 ? 'start' : isEnd(label) ? 'end' : 'step',
  }));
  if (entries[0].kind === 'decision') entries.unshift({ label: 'Start', kind: 'start' });
  if (entries[entries.length - 1].kind === 'decision') entries.push({ label: 'End', kind: 'end' });
  const nodes = entries.map((node, index) => ({ id: `n${index + 1}`, ...node }));
  const edges = [];
  const warnings = [];
  const ambiguities = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const node = nodes[i];
    const next = nodes[i + 1];
    if (node.kind === 'decision') {
      const end = nodes.slice(i + 1).find(candidate => candidate.kind === 'end') ?? nodes[nodes.length - 1];
      edges.push({ from: node.id, to: next.id, label: 'yes' });
      edges.push({ from: node.id, to: end.id, label: 'no' });
      warnings.push(`Review inferred yes/no paths for decision ${node.id}${end.id === next.id ? ' (both lead to the same step)' : ''}.`);
      // One named sentence per spike rule: questions and if/when/whether lines
      // are decisions, and yes/no targets are assumed rather than stated.
      const same = end.id === next.id ? ', and both assumed paths lead to the same step' : '';
      ambiguities.push({
        id: node.id,
        sentence: `${node.id} (${node.label}) is ambiguous under the spike rule: a question or a line starting with if, when, or whether is a decision, yes is assumed to continue to ${next.label}, and no is assumed to go to ${end.label}${same}, which the text did not state.`,
      });
    } else if (node.kind !== 'end') {
      edges.push({ from: node.id, to: next.id });
    }
  }

  // Quoted labels with numeric entities keep punctuation and Mermaid delimiters safe.
  const quote = value => `"${value.replace(/#/g, '#35;').replace(/&/g, '#38;').replace(/"/g, '#quot;').replace(/</g, '#60;').replace(/>/g, '#62;').replace(/\n/g, ' ')}"`;
  const mermaid = ['flowchart TD'];
  for (const node of nodes) {
    const label = quote(node.label);
    const shape = node.kind === 'start' || node.kind === 'end' ? `([${label}])` : node.kind === 'decision' ? `{${label}}` : `[${label}]`;
    mermaid.push(`  ${node.id}${shape}`);
  }
  for (const edge of edges) {
    mermaid.push(`  ${edge.from} -->${edge.label ? `|${quote(edge.label)}|` : ''} ${edge.to}`);
  }
  return { flow: { title, nodes, edges }, mermaid: mermaid.join('\n'), warnings, ambiguities };
}
