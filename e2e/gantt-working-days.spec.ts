import { testTimeout } from './testTimeout';
import { expect, test, type Locator, type Page } from '@playwright/test';

const FRIDAY_ON = `diagram: gantt
title: Working days
start: 2026-03-06
workdays: on

task Build {
  start: 2026-03-06
  duration: 5d
}`;

const FRIDAY_OFF = FRIDAY_ON.replace('workdays: on', 'workdays: off');

const HOLIDAY = `diagram: gantt
title: Holiday
start: 2026-03-09
workdays: on
holidays: 2026-03-11

task Build {
  start: 2026-03-09
  duration: 3d
}`;

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

function bar(page: Page, name: string): Locator {
  return page.locator(`[data-testid^="gantt-task-bar"][data-task-name="${name}"]`);
}

async function openBlankGantt(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('toast-item')).toHaveCount(0);
}

test.describe('Gantt working days', () => {
  test.describe.configure({ timeout: testTimeout(60_000) });

  test('5d from Friday ends Thursday, shades weekends, and ends Tuesday when off', async ({ page }) => {
    await openBlankGantt(page);
    await setEditorDsl(page, FRIDAY_ON);
    await expect(bar(page, 'Build')).toBeVisible();
    await expect(page.getByTestId('toast-item')).toHaveCount(0);
    await page.getByRole('button', { name: 'Day', exact: true }).click();

    await expect(bar(page, 'Build').locator('title')).toHaveText('Ends 2026-03-12');
    await expect(page.locator('[data-testid="gantt-nonworking-band"][data-date="2026-03-07"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="gantt-nonworking-band"][data-date="2026-03-08"]').first()).toBeVisible();

    await setEditorDsl(page, FRIDAY_OFF);
    await expect(bar(page, 'Build').locator('title')).toHaveText('Ends 2026-03-10');
    await expect(page.getByTestId('gantt-nonworking-band')).toHaveCount(0);
  });

  test('a holiday band shows the date', async ({ page }) => {
    await openBlankGantt(page);
    await setEditorDsl(page, HOLIDAY);
    await expect(bar(page, 'Build')).toBeVisible();
    await expect(page.getByTestId('toast-item')).toHaveCount(0);
    await page.getByRole('button', { name: 'Day', exact: true }).click();

    const holiday = page.locator('[data-testid="gantt-nonworking-band"][data-date="2026-03-11"]');
    await expect(holiday.first()).toBeVisible();
    await expect(holiday.first().locator('title')).toHaveText('2026-03-11');
    await expect(bar(page, 'Build').locator('title')).toHaveText('Ends 2026-03-12');
  });
});
