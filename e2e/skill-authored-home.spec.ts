import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
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

function authorBoardFile(): { path: string; steps: string } {
  const dir = mkdtempSync(join(tmpdir(), 'diagram-tool-skill-home-'));
  const created = createBoard({ title: 'Intake', mode: 'flow', source: SOURCE }, dir);
  const path = join(dir, created.filename);
  const steps = seedTypeStepsForSkillBoard('flow', SOURCE, true);
  if (!steps) throw new Error('skill board did not seed Type steps');
  return { path, steps };
}

async function openHome(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

test.describe('skill-authored board on Home', () => {
  test.describe.configure({ timeout: testTimeout(60_000) });

  test('local MCP create_board is listed on Home and opens as editable text', async ({ page }) => {
    const cloud: string[] = [];
    page.on('request', request => {
      if (CLOUD_HOST.test(request.url())) cloud.push(request.url());
    });

    const { path, steps } = authorBoardFile();
    const file = JSON.parse(readFileSync(path, 'utf8')) as { board: { skillAuthored?: boolean } };
    expect(file.board.skillAuthored).toBe(true);

    await openHome(page);
    await page.getByTestId('dashboard-import-file').setInputFiles(path);

    const mark = page.getByTestId('skill-authored-mark').first();
    await expect(mark).toBeVisible();
    await expect(mark).toHaveText('Written by a skill, editable as text');
    await expect(page.getByRole('heading', { name: 'Intake' })).toBeVisible();

    await page.getByRole('heading', { name: 'Intake' }).click();
    const input = page.getByTestId('type-steps-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(steps);
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.getByText('FNOL').first()).toBeVisible();

    const edited = `${steps}\nSend receipt`;
    await input.fill(edited);
    await expect(input).toHaveValue(edited);
    await page.getByTestId('build-steps').click();
    await expect(page.getByText('Send receipt').first()).toBeVisible();
    await expect(input).toHaveValue(edited);

    expect(cloud).toEqual([]);
  });
});
