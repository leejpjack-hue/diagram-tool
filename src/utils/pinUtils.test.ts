import { describe, it, expect } from 'vitest';
import { applyCanvasPins, setNodePin, setGroupPin } from './pinUtils';
import { parseDiagram } from '../parser/parser';

describe('setNodePin', () => {
  const DSL = `diagram: architecture
service Auth {
  color: "#3b82f6"
  connects: Db
}

database Db {
  type: postgresql
}`;

  it('inserts at: into a node block', () => {
    const out = setNodePin(DSL, 'Auth', 560, 120);
    expect(out).toMatch(/service Auth \{[^}]*at: 560, 120/);
    expect(parseDiagram(out).pins?.auth).toEqual({ x: 560, y: 120 });
  });

  it('updates an existing at:', () => {
    const once = setNodePin(DSL, 'Auth', 100, 100);
    const twice = setNodePin(once, 'Auth', 560, 120);
    // exactly one at: line for Auth
    const block = twice.match(/service Auth \{[^}]*\}/)![0];
    expect(block.match(/at:/g)).toHaveLength(1);
    expect(parseDiagram(twice).pins?.auth).toEqual({ x: 560, y: 120 });
  });

  it('rounds coordinates', () => {
    const out = setNodePin(DSL, 'Db', 840.7, 100.2);
    expect(parseDiagram(out).pins?.db).toEqual({ x: 841, y: 100 });
  });

  it('appends a node block for a connection-only flow node', () => {
    const flow = `diagram: flow\nstart Begin\nBegin -> Step`;
    const out = setNodePin(flow, 'Step', 200, 80);
    expect(out).toMatch(/node Step \{\n {2}at: 200, 80\n\}/);
    expect(parseDiagram(out).pins?.step).toEqual({ x: 200, y: 80 });
  });
});

describe('applyCanvasPins', () => {
  const DSL = `diagram: architecture
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

  it('updates architecture pins for every supplied node', () => {
    const parsed = parseDiagram(DSL);
    const out = applyCanvasPins(
      DSL,
      parsed.nodes,
      new Map([
        ['gateway', { x: 180, y: 240 }],
        ['api', { x: 320, y: 100 }],
      ]),
    );
    expect(out).toMatch(/service Gateway \{[^}]*at: 180, 240/);
    expect(out).toMatch(/service API \{[^}]*at: 320, 100/);
    expect(out).not.toBe(DSL);
  });

  it('is a no-op when rounded coordinates already match', () => {
    const parsed = parseDiagram(DSL);
    const out = applyCanvasPins(
      DSL,
      parsed.nodes,
      new Map([
        ['gateway', { x: 40.2, y: 100.4 }],
        ['api', { x: 320, y: 100 }],
      ]),
    );
    expect(out).toBe(DSL);
  });
});

describe('setGroupPin', () => {
  const DSL = `diagram: architecture
service A {
  connects: B
}
service B {
}

group Edge {
  color: "#f97316"
  contains: A, B
}`;

  it('writes at: and size: into a group block', () => {
    const out = setGroupPin(DSL, 'Edge', 250, 150, 260, 380);
    const parsed = parseDiagram(out);
    const g = parsed.groups.find(x => x.id === 'edge');
    expect(g).toMatchObject({ x: 250, y: 150, width: 260, height: 380 });
  });

  it('updates existing at:/size: without duplicating', () => {
    const once = setGroupPin(DSL, 'Edge', 0, 0, 10, 10);
    const twice = setGroupPin(once, 'Edge', 250, 150, 260, 380);
    const block = twice.match(/group Edge \{[^}]*\}/)![0];
    expect(block.match(/at:/g)).toHaveLength(1);
    expect(block.match(/size:/g)).toHaveLength(1);
  });
});
