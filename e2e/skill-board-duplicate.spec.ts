import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createBoard } from '../src/utils/localMcpBoards';
import { seedTypeStepsForSkillBoard } from '../src/parser/boardToPlainSteps';
import { testTimeout } from './testTimeout';

const SOURCE = `diagram: flow
title: Intake
start FNOL
FNOL -> Review
end Review
`;

const CLOUD_HOST = /teqcon|supabase\.co|diagram-tool\.com/i;
const SHOTS = '/opt/cursor/artifacts';

function authorBoardFile(): { path: string; steps: string } {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-tool-skill-duplicate-'));
  const created = createBoard({ title: 'Intake', mode: 'flow', source: SOURCE }, dir);
  const path = join(dir, created.filename);
  const steps = seedTypeStepsForSkillBoard('flow', SOURCE, true);
  if (!steps) throw new Error('skill board did not seed Type steps');
  return { path, steps };
}

function boardCard(page: Page, title: string): Locator {
  return page.locator('article').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });
}

async function openHome(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

async function fitCanvas(page: Page) {
  const fit = page.locator('.react-flow__controls-fitview');
  if (await fit.count()) await fit.click();
}

async function optionalText(locator: Locator): Promise<string | null> {
  if (await locator.count() === 0) return null;
  return (await locator.first().textContent())?.trim() ?? null;
}

async function editorSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } };
    }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}

test.describe('skill-authored board duplicate', () => {
  test.describe.configure({ timeout: testTimeout(90_000) });

  test('Home duplicate is a human-owned editable copy and leaves the original unchanged', async ({ page }) => {
    const cloud: string[] = [];
    const skillRuns: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (CLOUD_HOST.test(url)) cloud.push(url);
      if (url.includes('/api/skills/type-to-flow/run')) skillRuns.push(url);
    });

    const { path, steps } = authorBoardFile();
    const file = JSON.parse(readFileSync(path, 'utf8')) as { board: { skillAuthored?: boolean } };
    expect(file.board.skillAuthored).toBe(true);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openHome(page);
    await page.getByTestId('dashboard-import-file').setInputFiles(path);

    const original = boardCard(page, 'Intake');
    await expect(original.getByTestId('skill-authored-mark')).toHaveText('Written by a skill, editable as text');
    await expect(original.getByTestId('human-authored-mark')).toHaveCount(0);

    await original.getByRole('button', { name: 'Actions for Intake' }).click();
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();

    const copy = boardCard(page, 'Intake (copy)');
    await expect(copy).toBeVisible();
    await expect(copy.getByTestId('human-authored-mark')).toHaveText('Written by a human');
    await expect(copy.getByTestId('skill-authored-mark')).toHaveCount(0);
    await expect(original.getByTestId('skill-authored-mark')).toHaveText('Written by a skill, editable as text');
    await expect(page.locator('article')).toHaveCount(2);

    mkdirSync(SHOTS, { recursive: true });
    const allBoards = page.locator('section').filter({ has: page.getByRole('heading', { name: /All boards/ }) });
    await allBoards.scrollIntoViewIfNeeded();
    await allBoards.screenshot({ path: join(SHOTS, 'home-duplicate-boards.png') });
    await copy.screenshot({ path: join(SHOTS, 'home-duplicate-human-card.png') });
    await original.screenshot({ path: join(SHOTS, 'home-duplicate-original-card.png') });

    await copy.getByTestId('open-as-text').click();
    const input = page.getByTestId('type-steps-input');
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();
    await expect(input).toHaveValue(steps);
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByText('FNOL').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pin\b/i })).toHaveCount(0);
    await expect(page.getByText('Pin chrome')).toHaveCount(0);
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SHOTS, 'duplicate-open-as-text.png') });

    const edited = `${steps}\nSend receipt`;
    await input.fill(edited);
    await expect(input).toHaveValue(edited);
    await page.getByTestId('build-steps').click();
    const receipt = page.locator('.react-flow__node', { hasText: 'Send receipt' });
    await expect(receipt).toBeVisible();
    await fitCanvas(page);
    await expect(receipt).toBeInViewport();
    await expect(input).toHaveValue(edited);
    await expect.poll(async () => editorSource(page)).toContain('Send receipt');
    const copySource = await editorSource(page);
    expect(copySource).toContain('FNOL');
    expect(copySource).toContain('Send receipt');
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SHOTS, 'duplicate-edited.png') });

    const notes = {
      catalogSource: await optionalText(page.getByTestId('skill-catalog-source-note')),
      catalogReload: await optionalText(page.getByTestId('skill-catalog-reload-note')),
      catalogError: await optionalText(page.getByTestId('skill-catalog-error')),
      catalogLoading: await optionalText(page.getByTestId('skill-catalog-loading')),
      offlineBanner: await optionalText(page.getByTestId('offline-banner')),
      runTypeToFlowNote: await optionalText(page.getByText('Run type-to-flow sends these steps to the DiagramTool skills host.')),
      buildLocalNote: await optionalText(page.getByText('Build board runs locally.')),
      buildToast: await optionalText(page.getByText(/Built \d+ steps? onto the board/)),
    };

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const humanCard = page.locator('article').filter({ has: page.getByTestId('human-authored-mark') });
    const skillCard = page.locator('article').filter({ has: page.getByTestId('skill-authored-mark') });
    await expect(humanCard).toHaveCount(1);
    await expect(skillCard).toHaveCount(1);
    const humanTitle = (await humanCard.getByRole('heading').innerText()).trim();
    const skillTitle = (await skillCard.getByRole('heading').innerText()).trim();
    await expect(skillCard.getByTestId('skill-authored-mark')).toHaveText('Written by a skill, editable as text');
    await expect(humanCard.getByTestId('human-authored-mark')).toHaveText('Written by a human');
    const allBoardsAfter = page.locator('section').filter({ has: page.getByRole('heading', { name: /All boards/ }) });
    await allBoardsAfter.scrollIntoViewIfNeeded();
    await allBoardsAfter.screenshot({ path: join(SHOTS, 'home-after-edit.png') });

    await skillCard.getByTestId('open-as-text').click();
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();
    await expect(input).toHaveValue(steps);
    await expect(page.locator('.react-flow__node', { hasText: 'Send receipt' })).toHaveCount(0);
    await fitCanvas(page);
    await expect(page.locator('.react-flow__node', { hasText: 'FNOL' })).toBeInViewport();
    await expect(page.locator('.react-flow__node', { hasText: 'Review' })).toBeInViewport();
    await expect.poll(async () => editorSource(page)).toContain('start FNOL');
    const originalSource = await editorSource(page);
    expect(originalSource).toContain('FNOL -> Review');
    expect(originalSource).toContain('end Review');
    expect(originalSource).not.toContain('Send receipt');
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SHOTS, 'original-unchanged.png') });

    writeFileSync(join(SHOTS, 'duplicate-observed.txt'), [
      `human card title after returning Home: ${humanTitle}`,
      `skill card title after returning Home: ${skillTitle}`,
      `catalog source note: ${notes.catalogSource ?? '(not shown)'}`,
      `catalog reload note: ${notes.catalogReload ?? '(not shown)'}`,
      `catalog error: ${notes.catalogError ?? '(not shown)'}`,
      `catalog loading: ${notes.catalogLoading ?? '(not shown)'}`,
      `offline banner: ${notes.offlineBanner ?? '(not shown)'}`,
      `run type-to-flow note: ${notes.runTypeToFlowNote ?? '(not shown)'}`,
      `build local note: ${notes.buildLocalNote ?? '(not shown)'}`,
      `build toast: ${notes.buildToast ?? '(not shown)'}`,
      `cloud requests: ${cloud.length === 0 ? '(none)' : cloud.join(', ')}`,
      `type-to-flow run requests: ${skillRuns.length === 0 ? '(none)' : skillRuns.join(', ')}`,
    ].join('\n'));

    expect(skillRuns).toEqual([]);
    expect(cloud).toEqual([]);
  });
});
