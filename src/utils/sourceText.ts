import { isMermaidFlow, isMermaidSequence, mermaidFlowToDSL } from '../parser/mermaidFlow';
import { parseDiagram } from '../parser/parser';
import { parseSequenceSource } from '../components/Sequence/sequenceParser';
import { renameParticipant } from '../components/Sequence/sequenceEdit';
import type { BoardMode } from './boardManager';
import type { ParsedDiagram } from '../store/types';

export type ApplySourceResult =
  | { ok: true; kind: 'diagram'; parsed: ParsedDiagram }
  | { ok: true; kind: 'sequence' }
  | { ok: true; kind: 'gantt' }
  | { ok: false; error: string };

const isGanttSource = (text: string) => /^\s*diagram:\s*gantt\b/im.test(text);

export { isMermaidFlow, isMermaidSequence };

export function extractSourceTitle(text: string, fallback = 'Imported diagram'): string {
  const mermaid = text.match(/^\s*title\s*:?\s+(.+)$/im);
  if (mermaid?.[1]) return mermaid[1].trim().replace(/^["']|["']$/g, '');
  return fallback;
}

export function detectRawDiagramImport(filename: string, text: string): { mode: BoardMode; title: string; dslText: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null;

  const base = filename.replace(/\.(mmd|mermaid|txt|md)$/i, '').trim() || 'Imported diagram';
  if (isMermaidSequence(trimmed)) {
    return { mode: 'sequence', title: extractSourceTitle(trimmed, base), dslText: text };
  }
  if (isMermaidFlow(trimmed)) {
    return { mode: 'flow', title: extractSourceTitle(trimmed, base), dslText: text };
  }

  const mermaidName = /\.(mmd|mermaid)$/i.test(filename);
  if (mermaidName && /sequenceDiagram\b/i.test(trimmed)) {
    return { mode: 'sequence', title: extractSourceTitle(trimmed, base), dslText: text };
  }
  if (mermaidName && /^(?:flowchart|graph)\b/im.test(trimmed)) {
    return { mode: 'flow', title: extractSourceTitle(trimmed, base), dslText: text };
  }
  return null;
}

export function applyBoardSource(text: string, mode: BoardMode | 'c4'): ApplySourceResult {
  if (mode === 'gantt' || isGanttSource(text)) return { ok: true, kind: 'gantt' };

  if (mode === 'sequence' || isMermaidSequence(text)) {
    if (mode !== 'sequence' && isMermaidSequence(text)) {
      return { ok: false, error: 'This is a sequenceDiagram. Open it on the Sequence tab or import it as a sequence board.' };
    }
    const result = parseSequenceSource(text);
    if (result.error) return { ok: false, error: result.error };
    return { ok: true, kind: 'sequence' };
  }

  try {
    const parsed = parseDiagram(text);
    return { ok: true, kind: 'diagram', parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Parse error' };
  }
}

function sanitizeMermaidId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_]/g, '');
  return clean || 'N';
}

export function parsedFlowToMermaid(diagram: ParsedDiagram): string {
  const dir = diagram.direction === 'LR' ? 'LR' : 'TD';
  const lines = [`flowchart ${dir}`];
  if (diagram.title && diagram.title !== 'Untitled Diagram' && diagram.title !== 'Flowchart') {
    lines.push(`title: ${diagram.title}`);
  }

  const idMap = new Map(diagram.nodes.map(node => [node.id, sanitizeMermaidId(node.name || node.id)]));
  for (const node of diagram.nodes) {
    if (node.type === 'annotation') continue;
    const id = idMap.get(node.id) ?? node.id;
    const label = node.type === 'flow'
      ? (node.properties.label || node.name)
      : node.name;
    lines.push(`  ${id}["${String(label).replace(/"/g, "'")}"]`);
  }
  for (const edge of diagram.edges) {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) continue;
    if (edge.label) lines.push(`  ${from} -->|${edge.label}| ${to}`);
    else lines.push(`  ${from} --> ${to}`);
  }
  for (const node of diagram.nodes) {
    const pin = diagram.pins?.[node.id];
    const id = idMap.get(node.id);
    if (pin && id) lines.push(`%% at ${id} ${Math.round(pin.x)} ${Math.round(pin.y)}`);
    if (node.type === 'flow' && node.properties.reversed && id) {
      lines.push(`%% reverse ${id}`);
    }
  }
  return lines.join('\n');
}

export function toMermaidSource(text: string, mode: BoardMode | 'c4'): string {
  if (mode === 'sequence' || isMermaidSequence(text)) return text;
  if (isMermaidFlow(text)) return text;
  try {
    return parsedFlowToMermaid(parseDiagram(text));
  } catch {
    return text;
  }
}

export function toDslSource(text: string, mode: BoardMode | 'c4'): string {
  if (mode === 'sequence' || isMermaidSequence(text)) return text;
  if (isMermaidFlow(text)) return mermaidFlowToDSL(text);
  return text;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renameMermaidFlowNode(text: string, id: string, newName: string): string {
  const name = newName.trim();
  if (!name) return text;
  const idRe = new RegExp(`\\b${escapeRegex(id)}(?=\\s*[\\[\\(\\{\\>]|\\s|$)`);
  const lines = text.split('\n').map(line => {
    const shape = new RegExp(`^(\\s*)${escapeRegex(id)}(\\s*)(\\[[^\\]]*\\]|\\([^)]*\\)|\\{[^}]*\\})`);
    if (shape.test(line)) {
      return line.replace(shape, `$1${id}$2[${name}]`);
    }
    return line;
  });
  // If the node was a bare id, give it a label wrapper on first mention.
  const joined = lines.join('\n');
  if (new RegExp(`${escapeRegex(id)}\\s*[\\[\\(\\{]`).test(joined)) return joined;
  return joined.replace(idRe, `${id}[${name}]`);
}

export function renameNodeInSource(
  text: string,
  node: { id: string; name: string },
  newName: string,
): string {
  const name = newName.trim();
  if (!name || name === node.name) return text;

  if (isMermaidSequence(text)) {
    return renameParticipant(text, node.id, name);
  }
  if (isMermaidFlow(text)) {
    return renameMermaidFlowNode(text, node.name, name);
  }

  const oldName = node.name;
  const oldRe = new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g');
  const declaration = new RegExp(
    `^(\\s*(?:service|database|queue|cloud|class|node)\\s+)${escapeRegex(oldName)}(\\s*\\{)`,
    'm',
  );
  let next = text.replace(declaration, `$1${name}$2`);
  next = next.replace(oldRe, name);
  return next;
}
