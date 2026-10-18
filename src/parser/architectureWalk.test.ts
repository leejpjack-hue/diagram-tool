import { describe, expect, it } from 'vitest';
import { parseDiagram } from './parser';
import { architectureHopCaption, architectureWalkSequence } from './architectureWalk';

const PATH = `diagram: architecture
title: Request path
service User {}
service App {}
service Agent {}
service Model {}
edge App -> Agent { label: "question" step: 2 }
edge User -> App { label: "asks" step: 1 }
edge Agent -> Model { label: "prompt" step: 3 }
edge Agent -> Tool { label: "search" step: 3 }
edge Model -> User { label: "aside" }
service Tool {}
`;

describe('architectureWalkSequence', () => {
  it('orders numbered hops and keeps duplicate steps in declaration order', () => {
    const diagram = parseDiagram(PATH);
    const hops = architectureWalkSequence(diagram);
    expect(hops.map(hop => hop.step)).toEqual([1, 2, 3, 3]);
    expect(hops.map(hop => hop.label)).toEqual(['asks', 'question', 'prompt', 'search']);
    expect(hops.map(hop => `${hop.from}->${hop.to}`)).toEqual([
      'user->app',
      'app->agent',
      'agent->model',
      'agent->tool',
    ]);
    expect(hops.every(hop => hop.edgeId.length > 0)).toBe(true);
  });

  it('skips a board with no numbered edges and a flow board', () => {
    const plain = parseDiagram(`diagram: architecture
service A {}
service B {}
edge A -> B { label: "go" }
`);
    expect(architectureWalkSequence(plain)).toEqual([]);
    const flow = parseDiagram(`diagram: flow
A -> B
`);
    expect(architectureWalkSequence(flow)).toEqual([]);
    expect(architectureWalkSequence(null)).toEqual([]);
  });

  it('builds the walk caption from node names', () => {
    const diagram = parseDiagram(PATH);
    const nameOf = (id: string) => diagram.nodes.find(node => node.id === id)?.name ?? id;
    const hops = architectureWalkSequence(diagram);
    expect(architectureHopCaption(hops[1], nameOf)).toBe('2 · App → Agent: question');
    expect(architectureHopCaption({ step: 4, from: 'model', to: 'user' }, nameOf)).toBe('4 · Model → User');
  });
});
