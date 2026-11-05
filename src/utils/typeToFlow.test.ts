import { describe, expect, it } from 'vitest';
import { adaptTypeToFlow, retargetAmbiguousNoEdge, type TypeToFlowResult } from './typeToFlow';
import fixture from '../../fixtures/type-to-flow/spike-output.json';
import ambiguous from '../../fixtures/type-to-flow/ambiguous-decision.json';
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
    expect(graph.nodes.map(node => [node.id, kind(node), node.type === 'flow' && node.properties.label])).toEqual(
      fixture.flow.nodes.map(node => [node.id, node.kind, node.label]),
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

  it('keeps a cleared spike envelope committable when it has no ambiguity list', () => {
    expect(fixture).not.toHaveProperty('ambiguities');
    expect(adaptTypeToFlow(fixture).graph.nodes.some(node => node.type === 'flow' && node.properties.nodeType === 'decision')).toBe(true);
  });

  it('accepts the intentional-ambiguity fixture and blocks an unnamed list', () => {
    const adapted = adaptTypeToFlow(ambiguous);
    expect(adapted.graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'n2', to: 'n4', label: 'no' }),
    ]));
    expect(ambiguous.ambiguities).toHaveLength(1);
    expect(ambiguous.ambiguities[0].sentence.endsWith('.')).toBe(true);
    expect(ambiguous.ambiguities[0].sentence.split('.').length).toBe(2);

    const unnamed = structuredClone(ambiguous);
    unnamed.ambiguities[0].id = 'not-a-decision';
    expect(() => adaptTypeToFlow(unnamed)).toThrow(/invalid ambiguity list/);
    const stepNamed = structuredClone(ambiguous);
    stepNamed.ambiguities[0].id = 'n3';
    expect(() => adaptTypeToFlow(stepNamed)).toThrow(/invalid ambiguity list/);
  });

  it('retargets only the pending no edge', () => {
    const edited = retargetAmbiguousNoEdge(ambiguous as TypeToFlowResult, 'n2', 'n3');
    expect(edited.flow.edges.find(edge => edge.from === 'n2' && edge.label === 'no')?.to).toBe('n3');
    expect(edited.mermaid).toContain('n2 -->|"no"| n3');
    expect(edited.mermaid).not.toContain('n2 -->|"no"| n4');
    expect(edited.ambiguities?.[0].sentence).toBe(ambiguous.ambiguities[0].sentence);
    const graph = adaptTypeToFlow(edited).graph;
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'n2', to: 'n3', label: 'no' }),
    ]));
    expect(graph.edges.some(edge => edge.from === 'n2' && edge.label === 'no' && edge.to === 'n4')).toBe(false);
  });
});
