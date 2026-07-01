import { describe, it, expect } from 'vitest';
import { calculateAutoLayout } from './autoLayout';

describe('calculateAutoLayout — regression for NaN positions', () => {
  it('produces finite positions for every node when no input has prior positions', () => {
    // The system-architecture DSL exposed a bug: when two connected nodes
    // were placed at the same starting position by the hierarchical pass,
    // the force-directed attraction divided 0/0 and propagated NaN to
    // every node in a single iteration.
    const nodes = [
      { id: 'browser', type: 'cloud', name: 'Browser' },
      { id: 'dsleditor', type: 'service', name: 'DSLEditor' },
      { id: 'parser', type: 'service', name: 'Parser' },
      { id: 'diagramstore', type: 'service', name: 'DiagramStore' },
      { id: 'mcpclient', type: 'cloud', name: 'MCPClient' },
    ];
    const edges = [
      { id: 'b1', from: 'browser', to: 'dsleditor' },
      { id: 'b2', from: 'dsleditor', to: 'parser' },
      { id: 'b3', from: 'parser', to: 'diagramstore' },
      { id: 'b4', from: 'mcpclient', to: 'mcpclient' },
    ];
    const positions = calculateAutoLayout(nodes, edges, 'TB');
    expect(positions.size).toBe(nodes.length);
    for (const [id, p] of positions) {
      expect(Number.isFinite(p.x), `node ${id} x is not finite: ${p.x}`).toBe(true);
      expect(Number.isFinite(p.y), `node ${id} y is not finite: ${p.y}`).toBe(true);
    }
  });

  it('handles two connected nodes that share the same starting position', () => {
    // Direct repro: the attraction loop used to produce 0/0 = NaN here.
    const nodes = [
      { id: 'a', type: 'service', name: 'A' },
      { id: 'b', type: 'service', name: 'B' },
    ];
    const edges = [{ id: 'e', from: 'a', to: 'b' }];
    const positions = calculateAutoLayout(nodes, edges, 'TB');
    expect(Number.isFinite(positions.get('a')!.x)).toBe(true);
    expect(Number.isFinite(positions.get('b')!.x)).toBe(true);
  });
});
