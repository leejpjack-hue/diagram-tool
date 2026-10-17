import { describe, expect, it } from 'vitest';
import { architectureHandleId } from './architectureHandleIds';
import { computeConnectionRouting, inferConnectionSides, type RoutedNode } from './connectionRouting';

function node(id: string, x: number, y: number, width?: number, height?: number): RoutedNode {
  return { id, position: { x, y }, width, height };
}

describe('inferConnectionSides', () => {
  const source = node('a', 0, 0);

  it('attaches right → left when the target sits to the right', () => {
    expect(inferConnectionSides({}, source, node('b', 240, 10))).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    });
  });

  it('attaches left → right when the target sits to the left', () => {
    expect(inferConnectionSides({}, source, node('b', -240, 8))).toEqual({
      sourceSide: 'left',
      targetSide: 'right',
    });
  });

  it('attaches bottom → top when the target sits below', () => {
    expect(inferConnectionSides({}, source, node('b', 12, 220))).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });
  });

  it('attaches top → bottom when the target sits above', () => {
    expect(inferConnectionSides({}, source, node('b', -6, -180))).toEqual({
      sourceSide: 'top',
      targetSide: 'bottom',
    });
  });

  it('infers a legacy edge that stores no sides', () => {
    const sides = inferConnectionSides({}, node('a', 80, 200), node('b', 420, 210));
    expect(sides).toEqual({ sourceSide: 'right', targetSide: 'left' });
  });

  it('keeps explicit architecture sides and fills a single side with its opposite', () => {
    expect(inferConnectionSides(
      { sourceSide: 'bottom', targetSide: 'right' },
      source,
      node('b', 300, 0),
    )).toEqual({ sourceSide: 'bottom', targetSide: 'right' });
    expect(inferConnectionSides({ sourceSide: 'left' }, source, node('b', 300, 0))).toEqual({
      sourceSide: 'left',
      targetSide: 'right',
    });
    expect(inferConnectionSides({ targetSide: 'top' }, source, node('b', 300, 0))).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });
  });

  it('uses box centers when both nodes have a size, and top-left anchors when they do not', () => {
    const wide = node('a', 0, 0, 400, 40);
    const small = node('b', 50, 80, 40, 40);
    expect(inferConnectionSides({}, wide, small)).toEqual({ sourceSide: 'left', targetSide: 'right' });
    expect(inferConnectionSides({}, node('a', 0, 0), node('b', 50, 80))).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });
  });
});

describe('computeConnectionRouting', () => {
  it('routes an architecture edge with explicit sides to the same slotted handles', () => {
    const routing = computeConnectionRouting(
      [{ id: 'e1', from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left' }],
      [node('a', 0, 0), node('b', 200, 40)],
    );
    expect(routing.edgeRoutes.get('e1')).toEqual({
      sourceHandle: architectureHandleId('source', 'right', 0),
      targetHandle: architectureHandleId('target', 'left', 0),
    });
    expect(routing.nodeSlots.get('a')?.source?.right).toBe(1);
    expect(routing.nodeSlots.get('b')?.target?.left).toBe(1);
  });

  it('gives a second edge on the same side the next slot', () => {
    const routing = computeConnectionRouting(
      [
        { id: 'e1', from: 'a', to: 'b' },
        { id: 'e2', from: 'a', to: 'c' },
      ],
      [node('a', 0, 0), node('b', 200, 10), node('c', 220, 30)],
    );
    expect(routing.edgeRoutes.get('e1')?.sourceHandle).toBe('source-right-0');
    expect(routing.edgeRoutes.get('e2')?.sourceHandle).toBe('source-right-1');
    expect(routing.nodeSlots.get('a')?.source?.right).toBe(2);
  });

  it('infers a flow edge that has no stored sides', () => {
    const routing = computeConnectionRouting(
      [{ id: 'a_to_b_0', from: 'a', to: 'b' }],
      [node('a', 100, 80, 170, 64), node('b', 100, 320, 170, 64)],
    );
    expect(routing.edgeRoutes.get('a_to_b_0')).toEqual({
      sourceHandle: 'source-bottom-0',
      targetHandle: 'target-top-0',
    });
  });

  it('returns empty routing when there is nothing to attach', () => {
    expect(computeConnectionRouting([], [node('a', 0, 0)]).edgeRoutes.size).toBe(0);
    expect(computeConnectionRouting([{ id: 'e', from: 'a', to: 'b' }], []).edgeRoutes.size).toBe(0);
  });
});
