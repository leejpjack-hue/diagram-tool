import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createBoard } from '../src/utils/localMcpBoards';
import { seedTypeStepsForOpenAsText, seedTypeStepsForSkillBoard } from '../src/parser/boardToPlainSteps';
import { testTimeout } from './testTimeout';

const SKILL_SOURCE = `diagram: flow
title: Intake
start FNOL
FNOL -> Review
end Review
`;

const HUMAN_SOURCE = `diagram: flow
title: Handoff
start Draft
Draft -> Send
end Send
`;

const CLOUD_HOST = /teqcon|supabase\.co|diagram-tool\.com/i;
const SHOTS = '/opt/cursor/artifacts';

function authorFiles(): { skillPath: string; humanPath: string; skillSteps: string; humanSteps: string } {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-tool-home-author-'));
  const created = createBoard({ title: 'Intake', mode: 'flow', source: SKILL_SOURCE }, dir);
  const skillPath = join(dir, created.filename);
  const humanPath = join(dir, 'handoff.board.json');
  writeFileSync(humanPath, JSON.stringify({
    version: '3.0',
    kind: 'board',
    exportedAt: '2026-11-27T01:00:00.000Z',
    board: {
      title: 'Handoff',
      mode: 'flow',
      source: { kind: 'dsl', text: HUMAN_SOURCE },
      dslText: HUMAN_SOURCE,
      nodes: [],
      edges: [],
      frames: [],
      comments: [],
      layout: { pins: {} },
      updatedAt: '2026-11-27T01:00:00.000Z',
    },
  }));
  const skillSteps = seedTypeStepsForSkillBoard('flow', SKILL_SOURCE, true);
  const humanSteps = seedTypeStepsForOpenAsText('flow', HUMAN_SOURCE);
  if (!skillSteps || !humanSteps) throw new Error('expected Type steps for both boards');
  return { skillPath, humanPath, skillSteps, humanSteps };
}

function boardCard(page: Page, title: string): Locator {
  return page.locator('article').filter({ has: page.getByRole('heading', { name: title }) });
}

async function openHome(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

test.describe('Home skill versus human', () => {
  test.describe.configure({ timeout: testTimeout(90_000) });

  test('skill and human boards are distinct, and Open as text keeps source and canvas local', async ({ page }) => {
    const cloud: string[] = [];
    page.on('request', request => {
      if (CLOUD_HOST.test(request.url())) cloud.push(request.url());
    });

    const { skillPath, humanPath, skillSteps, humanSteps } = authorFiles();
    expect(skillSteps).not.toBe(humanSteps);

    await openHome(page);
    await page.getByTestId('dashboard-import-file').setInputFiles(skillPath);
    await expect(page.getByRole('heading', { name: 'Intake' })).toBeVisible();
    await page.getByTestId('dashboard-import-file').setInputFiles(humanPath);
    await expect(page.getByRole('heading', { name: 'Handoff' })).toBeVisible();

    const skill = boardCard(page, 'Intake');
    const human = boardCard(page, 'Handoff');
    const skillMark = skill.getByTestId('skill-authored-mark');
    const humanMark = human.getByTestId('human-authored-mark');
    await expect(skillMark).toHaveText('Written by a skill, editable as text');
    await expect(humanMark).toHaveText('Written by a human');
    await expect(skill.getByTestId('human-authored-mark')).toHaveCount(0);
    await expect(human.getByTestId('skill-authored-mark')).toHaveCount(0);

    const skillColor = await skillMark.evaluate(el => getComputedStyle(el).color);
    const humanColor = await humanMark.evaluate(el => getComputedStyle(el).color);
    const skillBg = await skillMark.evaluate(el => getComputedStyle(el).backgroundColor);
    const humanBg = await humanMark.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(skillColor).not.toBe(humanColor);
    expect(skillBg).not.toBe(humanBg);

    await expect(skill.getByTestId('board-last-edited')).toContainText('Edited');
    await expect(human.getByTestId('board-last-edited')).toContainText('Edited');
    await expect(skill.getByTestId('board-last-edited')).toHaveAttribute('datetime', /.+/);
    await expect(human.getByTestId('board-last-edited')).toHaveAttribute('datetime', /.+/);

    mkdirSync(SHOTS, { recursive: true });
    await skill.scrollIntoViewIfNeeded();
    await skill.screenshot({ path: join(SHOTS, 'home-skill-card.png') });
    await human.screenshot({ path: join(SHOTS, 'home-human-card.png') });
    await page.screenshot({ path: join(SHOTS, 'home-skill-vs-human.png'), fullPage: true });

    await openAsText(page, human, humanSteps, 'human-open-as-text.png');
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await openAsText(page, boardCard(page, 'Intake'), skillSteps, 'skill-open-as-text.png');
    await expect(page.getByRole('button', { name: /^Pin\b/i })).toHaveCount(0);
    await expect(page.getByText('Pin chrome')).toHaveCount(0);

    expect(cloud).toEqual([]);
  });
});

async function openAsText(page: Page, card: Locator, steps: string, shot: string) {
  await card.getByTestId('open-as-text').click();
  const input = page.getByTestId('type-steps-input');
  await expect(input).toBeVisible();
  await expect(input).toBeEditable();
  await expect(input).toHaveValue(steps);
  await expect(page.locator('.react-flow')).toBeVisible();
  await expect(page.getByText('Editor').first()).toBeVisible();
  await page.screenshot({ path: join(SHOTS, shot) });

  const edited = `${steps}\nSend receipt`;
  await input.fill(edited);
  await expect(input).toHaveValue(edited);
  await page.getByTestId('build-steps').click();
  await expect(page.getByText('Send receipt').first()).toBeVisible();
  await expect(input).toHaveValue(edited);
  await expect(page.locator('.react-flow')).toBeVisible();
}
