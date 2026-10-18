import { describe, expect, it } from 'vitest';
import { calculateAutoLayout } from '../utils/autoLayout';
import { inferConnectionSides } from '../components/Canvas/connectionRouting';
import { parseDiagram } from './parser';
import {
  plainArchitectureToDSL,
  plainPartsFromBoardSource,
  type PlainArchitectureLine,
} from './plainArchitecture';

const EXAMPLE = [
  'User -> Chat app: asks',
  'Chat app -> Agent: question',
  'Agent -> Model (AI): prompt',
  'Agent -> Vector DB: search',
  'Agent -> Search tool: web search',
  'inside Cloud: Chat app, Agent, Vector DB',
].join('\n');

function built(text: string, understood?: PlainArchitectureLine[]) {
  return parseDiagram(plainArchitectureToDSL(text, { understood }));
}

function node(text: string, name: string) {
  const found = built(text).nodes.find(item => item.name === name);
  expect(found, name).toBeDefined();
  return found!;
}

function serviceIcon(text: string, name: string): string | undefined {
  const found = node(text, name);
  if (found.type !== 'service') throw new Error(`${name} is ${found.type}`);
  return found.properties.icon;
}

describe('plainArchitectureToDSL', () => {
  it('turns the example lines into services, a database, a group, and a labelled edge', () => {
    const parsed = built(EXAMPLE);
    expect(parsed.mode).toBe('architecture');
    expect(parsed.nodes.map(item => item.name)).toEqual([
      'User',
      'Chat app',
      'Agent',
      'Model',
      'Vector DB',
      'Search tool',
    ]);
    expect(parsed.nodes.find(item => item.name === 'Vector DB')?.type).toBe('database');
    expect(parsed.nodes.find(item => item.name === 'Chat app')?.type).toBe('service');
    expect(parsed.groups).toEqual([
      expect.objectContaining({
        name: 'Cloud',
        contains: ['chat_app', 'agent', 'vector_db'],
      }),
    ]);
    const search = parsed.edges.find(edge => edge.from === 'agent' && edge.to === 'vector_db');
    expect(search?.label).toBe('search');
    expect(parsed.edges).toHaveLength(5);
    expect(plainPartsFromBoardSource(plainArchitectureToDSL(EXAMPLE))).toBe(EXAMPLE);
  });

  it('maps each kind rule', () => {
    expect(node('Orders DB -> API', 'Orders DB').type).toBe('database');
    expect(node('Cache (database) -> API', 'Cache').type).toBe('database');
    expect(node('OrdersDatabase -> API', 'OrdersDatabase').type).toBe('database');
    expect(node('Session Store -> API', 'Session Store').type).toBe('database');

    expect(node('Events Queue -> API', 'Events Queue').type).toBe('queue');
    expect(node('Jobs (queue) -> API', 'Jobs').type).toBe('queue');
    expect(node('EventBus -> API', 'EventBus').type).toBe('queue');
    expect(node('Updates Topic -> API', 'Updates Topic').type).toBe('queue');

    expect(node('Draft Agent -> API', 'Draft Agent').type).toBe('service');
    expect(serviceIcon('Draft Agent -> API', 'Draft Agent')).toBe('AI');
    expect(serviceIcon('Helper (AI) -> API', 'Helper')).toBe('AI');
    expect(serviceIcon('ChatGPT -> API', 'ChatGPT')).toBe('AI');
    expect(serviceIcon('Local LLM -> API', 'Local LLM')).toBe('AI');
    expect(serviceIcon('Writer (model) -> API', 'Writer')).toBe('AI');

    expect(node('Search tool -> API', 'Search tool').type).toBe('service');
    expect(serviceIcon('Search tool -> API', 'Search tool')).toBe('🔧');
    expect(serviceIcon('Lookup (tool) -> API', 'Lookup')).toBe('🔧');

    expect(node('Buyer -> API', 'Buyer').type).toBe('service');
    expect(serviceIcon('Buyer -> API', 'Buyer')).toBeUndefined();
    expect(serviceIcon('Human -> API', 'Human')).toBe('👤');
    expect(serviceIcon('Customer -> API', 'Customer')).toBe('👤');
    expect(serviceIcon('Buyer (user) -> API', 'Buyer')).toBe('👤');

    expect(node('Chat app -> API', 'Chat app').type).toBe('service');
    expect(serviceIcon('Chat app -> API', 'Chat app')).toBeUndefined();
  });

  it('keeps a parenthetical kind ahead of a suffix', () => {
    expect(node('User (db) -> API', 'User').type).toBe('database');
  });

  it('puts the label on the edge', () => {
    const parsed = built('A -> B: search');
    expect(parsed.edges[0].label).toBe('search');
    expect(built('A > B: search').edges[0].label).toBe('search');
    expect(built('A → B: search').edges[0].label).toBe('search');
    expect(built('A -> B').edges[0].label).toBeUndefined();
  });

  it('builds a group from inside', () => {
    const parsed = built('inside Data tier: Chat app, Vector DB');
    expect(parsed.groups[0].name).toBe('Data tier');
    expect(parsed.groups[0].contains).toEqual(['chat_app', 'vector_db']);
    expect(parsed.nodes.find(item => item.name === 'Vector DB')?.type).toBe('database');
  });

  it('strips list markers before reading the line', () => {
    const parsed = built('- User -> Chat app\n1. Chat app -> Agent');
    expect(parsed.nodes.map(item => item.name)).toEqual(['User', 'Chat app', 'Agent']);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges.find(edge => edge.from === 'user')?.step).toBeUndefined();
    expect(parsed.edges.find(edge => edge.to === 'agent')?.step).toBe(1);
  });

  it('turns a numbered arrow into step and a label', () => {
    const parsed = built('2. A -> B: question\n3. B -> C: answer\n3. B -> D: aside');
    expect(parsed.edges.map(edge => ({ from: edge.from, to: edge.to, label: edge.label, step: edge.step }))).toEqual([
      { from: 'a', to: 'b', label: 'question', step: 2 },
      { from: 'b', to: 'c', label: 'answer', step: 3 },
      { from: 'b', to: 'd', label: 'aside', step: 3 },
    ]);
    expect(plainArchitectureToDSL('2. A -> B: question')).toContain('step: 2');
    expect(plainArchitectureToDSL('A -> B: question')).not.toContain('step:');
  });

  it('merges duplicate names into one part', () => {
    const parsed = built('A -> B\nA -> C\nA -> B: again');
    expect(parsed.nodes.filter(item => item.name === 'A')).toHaveLength(1);
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.edges.find(edge => edge.to === 'b')?.label).toBe('again');
  });

  it('upgrades a plain service when a later line names a kind', () => {
    const parsed = built('Foo -> Bar\nFoo (db) -> Baz');
    expect(parsed.nodes.find(item => item.name === 'Foo')?.type).toBe('database');
    expect(parsed.nodes.filter(item => item.id === 'foo')).toHaveLength(1);
  });

  it('flags a line that was not understood and leaves it off the board', () => {
    const understood: PlainArchitectureLine[] = [];
    const parsed = built('A -> B\nhello there', understood);
    expect(parsed.nodes.map(item => item.name)).toEqual(['A', 'B']);
    expect(understood[1].warning).toMatch(/wasn't understood/);
    expect(understood[0].warning).toBeUndefined();
    expect(understood[0].summary).toBe('A → B');
  });

  it('throws on empty input', () => {
    expect(() => plainArchitectureToDSL('')).toThrow(/No parts found/);
    expect(() => plainArchitectureToDSL('   \n  ')).toThrow(/No parts found/);
  });

  it('does not refill a hand-written architecture board', () => {
    const handwritten = `diagram: architecture
title: Hand written
service API {
  connects: DB
}
database DB {}
`;
    expect(plainPartsFromBoardSource(handwritten)).toBeNull();
  });

  it('still refills after a pin is written into the generated source', () => {
    const dsl = plainArchitectureToDSL(EXAMPLE).replace(
      'service "Chat app" {}',
      'service "Chat app" {\n  at: 10, 20\n}',
    );
    expect(plainPartsFromBoardSource(dsl)).toBe(EXAMPLE);
  });

  it('leaves edge sides unset so layout can infer a short path', () => {
    const parsed = built('A -> B\nB -> C');
    const positions = calculateAutoLayout(parsed.nodes, parsed.edges, parsed.direction);
    expect(parsed.edges.every(edge => edge.sourceSide === undefined && edge.targetSide === undefined)).toBe(true);
    for (const edge of parsed.edges) {
      const source = positions.get(edge.from);
      const target = positions.get(edge.to);
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      const sides = inferConnectionSides(
        {},
        { id: edge.from, position: source! },
        { id: edge.to, position: target! },
      );
      expect(['top', 'right', 'bottom', 'left']).toContain(sides.sourceSide);
      expect(['top', 'right', 'bottom', 'left']).toContain(sides.targetSide);
    }
  });
});
