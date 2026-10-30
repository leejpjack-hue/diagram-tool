import { describe, expect, it } from 'vitest';
import { adaptTypeToFlow } from './typeToFlow';
import fixture from '../../fixtures/type-to-flow/spike-output.json';
import { parseDiagram } from '../parser/parser';

const kind = (node: ReturnType<typeof parseDiagram>['nodes'][number]) => {
  if (node.type !== 'flow') return 'other';
  return node.isStart ? 'start' : node.isEnd ? 'end' : node.properties.nodeType === 'decision' ? 'decision' : 'step';
};

describe('type-to-flow adapter', () => {
  it('preserves the spike graph and its kinds and labels after parsing saved source', () => {
    const adapted = adaptTypeToFlow(fixture);
    const graph = parseDiagram(adapted.source);
    expect(graph.title).toBe(fixture.flow.title);
    expect(graph.nodes.map(node => [node.id, kind(node), node.type === 'flow' && node.properties.label]).sort()).toEqual(
      fixture.flow.nodes.map(node => [node.id, node.kind, node.label]).sort(),
    );
    expect(graph.edges.map(({ from, to, label }) => ({ from, to, ...(label ? { label } : {}) }))).toEqual(fixture.flow.edges);
  });

  it('preserves quoted labels and rejects invalid decisions and dangling edges', () => {
    const sample = structuredClone(fixture);
    sample.flow.nodes[0].label = `Say "yes" and 'no' \\ safely`;
    const graph = adaptTypeToFlow(sample).graph;
    const first = graph.nodes.find(node => node.id === 'n1');
    expect(first?.type === 'flow' && first.properties.label).toBe(sample.flow.nodes[0].label);
    sample.flow.edges = sample.flow.edges.filter(edge => !(edge.from === 'n3' && edge.label === 'no'));
    expect(() => adaptTypeToFlow(sample)).toThrow(/two labeled/);
    sample.flow.edges[0].to = 'missing';
    expect(() => adaptTypeToFlow(sample)).toThrow(/invalid flow edge/);
  });
});
