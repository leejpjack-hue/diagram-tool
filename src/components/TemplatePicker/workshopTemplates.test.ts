import { describe, expect, it } from 'vitest';
import { BOARD_FORMAT_VERSION, buildBoardDocument } from '../../utils/boardFormat';
import { TEMPLATES, templateMatchesQuery } from './templates';
import {
  WORKSHOP_HOWTO,
  WORKSHOP_TEMPLATES,
  WORKSHOP_TITLES,
  isWorkshopTemplateId,
} from './workshopTemplates';

const NAMES = [
  WORKSHOP_TITLES.retro,
  WORKSHOP_TITLES.twoByTwo,
  WORKSHOP_TITLES.journey,
  WORKSHOP_TITLES.standup,
  WORKSHOP_TITLES.review,
] as const;

describe('workshop ICP starters', () => {
  it('registers five titled deck starters with the exact how-to lines', () => {
    expect(WORKSHOP_TEMPLATES).toHaveLength(5);
    expect(WORKSHOP_TEMPLATES.map(template => template.name)).toEqual([...NAMES]);
    expect(WORKSHOP_TEMPLATES.map(template => template.description)).toEqual([
      WORKSHOP_HOWTO.retro,
      WORKSHOP_HOWTO.twoByTwo,
      WORKSHOP_HOWTO.journey,
      WORKSHOP_HOWTO.standup,
      WORKSHOP_HOWTO.review,
    ]);
    for (const template of WORKSHOP_TEMPLATES) {
      expect(template.category).toBe('Workshop');
      expect(template.dsl).toContain(`title: ${template.name}`);
      expect(template.dsl).not.toMatch(/Untitled/i);
      expect(template.presentation?.length ?? 0).toBeGreaterThan(3);
      expect(TEMPLATES.some(entry => entry.id === template.id)).toBe(true);
      expect(isWorkshopTemplateId(template.id)).toBe(true);
    }
  });

  it('keeps each starter searchable by name and how-to', () => {
    for (const template of WORKSHOP_TEMPLATES) {
      expect(templateMatchesQuery(template, template.name)).toBe(true);
      expect(templateMatchesQuery(template, template.description.slice(0, 12))).toBe(true);
    }
    expect(TEMPLATES.some(template => template.name === 'AWS 3-Tier Web Application')).toBe(true);
    expect(TEMPLATES.some(template => template.name === 'Product Launch Plan' && template.mode === 'gantt')).toBe(true);
  });

  it('exports workshop decks as format 3.0 with board.frames left empty', () => {
    for (const template of WORKSHOP_TEMPLATES) {
      const document = buildBoardDocument({
        id: template.id,
        title: template.name,
        description: template.description,
        mode: template.mode,
        dslText: template.dsl,
        tags: template.tags,
        starred: false,
        createdAt: '2026-08-22T00:00:00.000Z',
        updatedAt: '2026-08-22T00:00:00.000Z',
        schemaVersion: 2,
        templateSourceId: template.id,
        presentation: { items: template.presentation ?? [], updatedAt: '2026-08-22T00:00:00.000Z' },
      });
      expect(document.version).toBe('3.0');
      expect(document.version).toBe(BOARD_FORMAT_VERSION);
      expect(document.board.frames).toEqual([]);
      expect(document.board.presentation?.items.length).toBeGreaterThan(3);
      expect(document.board.title).toBe(template.name);
    }
  });
});
