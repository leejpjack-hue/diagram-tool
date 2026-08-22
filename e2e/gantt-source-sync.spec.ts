import { expect, test, type Page } from '@playwright/test';

const GANTT_DSL = `diagram: gantt
title: Source Sync
start: 2026-03-01

task Planning {
  start: 2026-03-01
  end: 2026-03-05
  progress: 40
  color: #3b82f6
}

task Build {
  start: 2026-03-06
  end: 2026-03-12
  depends: Planning
  progress: 0
  color: #10b981
}`;

const GANTT_LONGER_PLANNING = `diagram: gantt
title: Source Sync
start: 2026-03-01

task Planning {
  start: 2026-03-01
  end: 2026-03-20
  progress: 40
  color: #3b82f6
}

task Build {
  start: 2026-03-06
  end: 2026-03-12
  depends: Planning
  progress: 0
  color: #10b981
}`;

const BAD_GANTT = `diagram: gantt
title: Source Sync
task Planning {
  start: 2026-03-01
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void; getValue: () => string }[] } } }).monaco;
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

async function getEditorDsl(page: Page) {
  return page.evaluate(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } } }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}

function planningBar(page: Page) {
  return page.locator('[data-testid^="gantt-task-bar"][data-task-name="Planning"]');
}

async function createGanttBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, GANTT_DSL);
  await expect(page.getByText('Planning', { exact: true }).first()).toBeVisible();
  await expect(planningBar(page)).toBeVisible();
}

test.describe('Gantt bidirectional source sync', () => {
  test.describe.configure({ timeout: 60_000 });

  test('drag a task on the canvas → source dates change', async ({ page }) => {
    await createGanttBoard(page);
    const before = await getEditorDsl(page);
    expect(before).toContain('start: 2026-03-01');
    expect(before).toContain('end: 2026-03-05');

    const bar = planningBar(page);
    const box = await bar.boundingBox();
    expect(box).toBeTruthy();
    const x = box!.x + box!.width * 0.5;
    const y = box!.y + box!.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 96, y, { steps: 16 });
    await page.mouse.up();

    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).not.toBe(before);
    const after = await getEditorDsl(page);
    expect(after).toMatch(/task Planning \{[\s\S]*start:/);
    expect(after).not.toContain('start: 2026-03-01\n  end: 2026-03-05');
  });

  test('edit source duration → bar width changes', async ({ page }) => {
    await createGanttBoard(page);
    const beforeBox = await planningBar(page).boundingBox();
    expect(beforeBox).toBeTruthy();

    await setEditorDsl(page, GANTT_LONGER_PLANNING);
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);

    await expect.poll(async () => {
      const box = await planningBar(page).boundingBox();
      return box?.width ?? 0;
    }, { timeout: 10_000 }).toBeGreaterThan((beforeBox!.width) + 20);
  });

  test('bad source keeps the last plan and shows an inline error', async ({ page }) => {
    await createGanttBoard(page);
    await setEditorDsl(page, BAD_GANTT);
    await expect(page.getByTestId('dsl-parse-error')).toBeVisible();
    await expect(page.getByTestId('dsl-parse-error')).toContainText(/Expected \}/i);
    await expect(page.getByText('Planning', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Build', { exact: true }).first()).toBeVisible();
    await expect(planningBar(page)).toBeVisible();
  });

  test('existing Gantt template still opens on the canvas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByLabel('Create a board').getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('button', { name: /Product Launch Plan/ }).click();
    await waitForEditor(page);
    await expect(page.getByText('Strategy').first()).toBeVisible();
    await expect(page.getByText('Product Launch Plan').first()).toBeVisible();
  });
});
