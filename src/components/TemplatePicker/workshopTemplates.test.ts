import { describe, expect, it } from 'vitest';
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
  });
});
