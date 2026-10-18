import type { ParsedDiagram } from '../store/types';

/** One numbered architecture hop, in walk order. */
export interface ArchitectureWalkHop {
  edgeId: string;
  step: number;
  from: string;
  to: string;
  label?: string;
}

/**
 * DT-ARCH-02 — numbered architecture edges in walk order.
 * Ascending `step`, declaration order when a number repeats (parallel hops).
 * Edges without a step are skipped. Non-architecture boards return [].
 */
export function architectureWalkSequence(diagram: ParsedDiagram | null | undefined): ArchitectureWalkHop[] {
  if (!diagram || diagram.mode !== 'architecture') return [];
  const numbered: { edge: ParsedDiagram['edges'][number]; order: number }[] = [];
  diagram.edges.forEach((edge, order) => {
    if (edge.step === undefined) return;
    if (!Number.isInteger(edge.step) || edge.step < 1) return;
    numbered.push({ edge, order });
  });
  numbered.sort((a, b) => (a.edge.step! - b.edge.step!) || (a.order - b.order));
  return numbered.map(({ edge }) => ({
    edgeId: edge.id,
    step: edge.step!,
    from: edge.from,
    to: edge.to,
    label: edge.label,
  }));
}

/** Caption `N · From → To: label`. The colon and label are omitted when blank. */
export function architectureHopCaption(
  hop: Pick<ArchitectureWalkHop, 'step' | 'from' | 'to' | 'label'>,
  nameOf: (id: string) => string,
): string {
  const from = nameOf(hop.from);
  const to = nameOf(hop.to);
  const label = hop.label?.trim();
  const ends = `${from} → ${to}`;
  return label ? `${hop.step} · ${ends}: ${label}` : `${hop.step} · ${ends}`;
}
