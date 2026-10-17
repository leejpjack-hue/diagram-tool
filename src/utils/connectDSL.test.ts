import { describe, it, expect } from 'vitest';
import { addConnectionDSL, updateFlowEdgeDSL } from './connectDSL';
import { parseDiagram } from '../parser/parser';

const ARCH_DSL = `diagram: architecture
title: Test

service Api {
  type: api
  connects: Db
}

database Db {
  type: postgresql
}

queue Bus {
  type: kafka
}`;

describe('addConnectionDSL — architecture', () => {
  it('appends to an existing connects list', () => {
    const out = addConnectionDSL(ARCH_DSL, 'architecture', 'Api', 'Bus');
    expect(out).toContain('connects: Db, Bus');
    const parsed = parseDiagram(out!);
    expect(parsed.edges.some(e => e.from === 'api' && e.to === 'bus')).toBe(true);
  });

  it('adds a connects line when the block has none', () => {
    const out = addConnectionDSL(ARCH_DSL, 'architecture', 'Db', 'Bus');
    expect(out).toContain('connects: Bus');
    const parsed = parseDiagram(out!);
    expect(parsed.edges.some(e => e.from === 'db' && e.to === 'bus')).toBe(true);
  });

  it('queue blocks can originate connections', () => {
    const out = addConnectionDSL(ARCH_DSL, 'architecture', 'Bus', 'Db');
    const parsed = parseDiagram(out!);
    expect(parsed.edges.some(e => e.from === 'bus' && e.to === 'db')).toBe(true);
  });

  it('returns null for duplicates', () => {
    expect(addConnectionDSL(ARCH_DSL, 'architecture', 'Api', 'Db')).toBeNull();
  });

  it('returns null for unknown source', () => {
    expect(addConnectionDSL(ARCH_DSL, 'architecture', 'Nope', 'Db')).toBeNull();
  });
});

const FLOW_DSL = `diagram: flow
title: Test Flow

start Begin
Begin -> StepA
end Done

node StepA {
  label: Step A
}

node StepB {
  label: Step B
}`;

describe('addConnectionDSL — flow', () => {
  it('appends an arrow line', () => {
    const out = addConnectionDSL(FLOW_DSL, 'flow', 'StepA', 'StepB');
    expect(out).toContain('StepA -> StepB');
    const parsed = parseDiagram(out!);
    expect(parsed.edges.some(e => e.from === 'stepa' && e.to === 'stepb')).toBe(true);
  });

  it('returns null when the edge already exists', () => {
    expect(addConnectionDSL(FLOW_DSL, 'flow', 'Begin', 'StepA')).toBeNull();
  });

  it('records the handles a drag-connect dropped on', () => {
    const out = addConnectionDSL(FLOW_DSL, 'flow', 'StepA', 'StepB', {
      sourceSide: 'right',
      targetSide: 'left',
    });
    expect(out).toContain('StepA -> StepB { from: right, to: left }');
    const parsed = parseDiagram(out!);
    const edge = parsed.edges.find(e => e.from === 'stepa' && e.to === 'stepb');
    expect(edge?.sourceSide).toBe('right');
    expect(edge?.targetSide).toBe('left');
  });
});

describe('updateFlowEdgeDSL', () => {
  it('moves an arrow onto a new target and stores the new sides', () => {
    const dsl = `diagram: flow
title: Test
Alpha -> Beta
node Alpha { label: Alpha }
node Beta { label: Beta }
node Gamma { label: Gamma }
`;
    const next = updateFlowEdgeDSL(dsl, 'Alpha', 'Beta', {
      toName: 'Gamma',
      sourceSide: 'bottom',
      targetSide: 'top',
    });
    expect(next).toContain('Alpha -> Gamma { from: bottom, to: top }');
    expect(next).not.toContain('Alpha -> Beta');
    const edge = parseDiagram(next!).edges.find(e => e.from === 'alpha');
    expect(edge?.to).toBe('gamma');
    expect(edge?.sourceSide).toBe('bottom');
    expect(edge?.targetSide).toBe('top');
  });

  it('keeps a pipe label when the sides change', () => {
    const next = updateFlowEdgeDSL('Check ->|No| Draft', 'Check', 'Draft', {
      sourceSide: 'left',
      targetSide: 'left',
    });
    expect(next).toBe('Check ->|No| Draft { from: left, to: left }');
  });
});
