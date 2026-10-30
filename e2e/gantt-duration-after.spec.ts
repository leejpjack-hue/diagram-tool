import { testTimeout } from './testTimeout';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROLLOUT = `diagram: gantt
title: Rollout
start: 2026-03-01

task Design {
  duration: 3d
}

task Build {
  duration: 5d
  after: Design
}

task Launch {
  milestone: true
  after: Build
}`;

const ROLLOUT_DESIGN_5D = ROLLOUT.replace('duration: 3d', 'duration: 5d');

const MERMAID = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
Design :a1, 2026-08-01, 4d
Implement :after a1, 5d
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function setEditorDsl(page: Page, dsl: string) {
  await waitForEditor(page);
  await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');
  await page.evaluate(value => {
    (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
  }, dsl);
}

function row(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-task-row"][data-task-name="${name}"]`);
}

function bar(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-task-bar"][data-task-name="${name}"]`);
}

function milestone(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-milestone"][data-task-name="${name}"]`);
}

async function createGanttBoard(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, ROLLOUT);
  await expect(row(page, 'Design')).toBeVisible();
  await page.getByRole('button', { name: 'Day', exact: true }).click();
  await expect.poll(async () => (await bar(page, 'Design').boundingBox())?.width ?? 0).toBeGreaterThan(100);
}

test.describe('Gantt duration and after', () => {
  test.describe.configure({ timeout: testTimeout(60_000) });

  test('places bars and dependency lines, then shifts the chain when Design grows', async ({ page }) => {
    await createGanttBoard(page);

    await expect(row(page, 'Design')).toHaveAttribute('data-start', '2026-03-01');
    await expect(row(page, 'Design')).toHaveAttribute('data-end', '2026-03-04');
    await expect(row(page, 'Build')).toHaveAttribute('data-start', '2026-03-05');
    await expect(row(page, 'Build')).toHaveAttribute('data-end', '2026-03-10');
    await expect(row(page, 'Launch')).toHaveAttribute('data-start', '2026-03-10');
    await expect(page.getByTestId('gantt-dependency-line')).toHaveCount(2);
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);

    const design = await bar(page, 'Design').boundingBox();
    const build = await bar(page, 'Build').boundingBox();
    const launch = await milestone(page, 'Launch').boundingBox();
    expect(design).toBeTruthy();
    expect(build).toBeTruthy();
    expect(launch).toBeTruthy();
    const gap = build!.x - (design!.x + design!.width);
    expect(gap).toBeGreaterThan(30);
    expect(gap).toBeLessThan(50);
    expect(build!.width).toBeGreaterThan(design!.width + 60);
    expect(build!.width).toBeLessThan(design!.width + 100);
    const launchCenter = launch!.x + launch!.width / 2;
    expect(Math.abs(launchCenter - (build!.x + build!.width))).toBeLessThan(8);

    await setEditorDsl(page, ROLLOUT_DESIGN_5D);
    await expect(row(page, 'Build')).toHaveAttribute('data-start', '2026-03-07');
    await expect(row(page, 'Launch')).toHaveAttribute('data-start', '2026-03-12');
    await expect(row(page, 'Design')).toHaveAttribute('data-end', '2026-03-06');

    await expect.poll(async () => (await bar(page, 'Build').boundingBox())?.x ?? 0).toBeGreaterThan(build!.x + 70);
    await expect.poll(async () => {
      const box = await milestone(page, 'Launch').boundingBox();
      return box ? box.x + box.width / 2 : 0;
    }).toBeGreaterThan(launchCenter + 70);

    const designAfter = await bar(page, 'Design').boundingBox();
    expect(designAfter!.width).toBeGreaterThan(design!.width + 70);
    await expect(page.getByTestId('gantt-dependency-line')).toHaveCount(2);
  });

  test('opens a mermaid gantt with after and draws the dependency', async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as { showOpenFilePicker?: unknown };
      delete host.showOpenFilePicker;
    });
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
    await waitForEditor(page);

    const path = join(tmpdir(), `diagram-tool-gantt-after-${Date.now()}.mmd`);
    writeFileSync(path, MERMAID);

    await page.getByRole('button', { name: 'File' }).click();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Open…' }).click(),
    ]);
    await fileChooser.setFiles(path);

    await expect(row(page, 'Design')).toBeVisible();
    await expect(row(page, 'Implement')).toBeVisible();
    await expect(page.getByTestId('gantt-dependency-line')).toHaveCount(1);
    await expect(row(page, 'Implement')).toHaveAttribute('data-start', '2026-08-06');
  });
});
