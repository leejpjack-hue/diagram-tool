import { describe, expect, it } from 'vitest';
import { parseDiagram } from '../../parser/parser';
import { TEMPLATES, templateMatchesQuery } from './templates';

describe('AI workflow template (DT-AI-02)', () => {
  const template = TEMPLATES.find(entry => entry.id === 'flow-ai-workflow');

  it('registers one Flow template named AI workflow', () => {
    expect(template).toBeDefined();
    expect(template?.name).toBe('AI workflow');
    expect(template?.category).toBe('Flow');
    expect(template?.mode).toBe('flow');
    expect(TEMPLATES.filter(entry => entry.id === 'flow-ai-workflow')).toHaveLength(1);
  });

  it('parses with exactly the five plain-word nodes', () => {
    const result = parseDiagram(template!.dsl);
    expect(result.mode).toBe('flow');
    expect(result.nodes.map(node => node.id).sort()).toEqual(['ask', 'check', 'model', 'reply', 'tool']);
    for (const node of result.nodes) {
      // @ts-expect-error label lives on node properties for flow nodes
      expect(node.properties?.label ?? node.label).toMatch(/^(Human ask|Model|Tool|Check|Reply)$/);
    }
  });

  it('connects Check back to Model on retry and on to Reply on ok', () => {
    const result = parseDiagram(template!.dsl);
    const retry = result.edges.find(edge => edge.from === 'check' && edge.to === 'model');
    const ok = result.edges.find(edge => edge.from === 'check' && edge.to === 'reply');
    expect(retry?.label).toBe('retry');
    expect(ok?.label).toBe('ok');
  });

  it('is searchable like other templates', () => {
    expect(templateMatchesQuery(template!, 'ai workflow')).toBe(true);
    expect(templateMatchesQuery(template!, '工作流')).toBe(true);
  });
});
