import { expect, test, type Page } from '@playwright/test';

const SMALL_DSL = `diagram: architecture
title: Size Meter Small
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

const SMALLER_THEN_LARGER = `diagram: architecture
title: Size Meter Small
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}
service Worker {
  at: 320, 260
}`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void }[] } } }).monaco;
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

async function createArchitectureBoard(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, SMALL_DSL);
  await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
  await expect(page.getByTestId('rf__node-api')).toBeVisible();
}

/** DEV-only query fixture — sets the count without creating thousands of nodes. */
async function applyBoardSizeFixture(page: Page, count: number) {
  await page.evaluate(n => {
    const url = new URL(window.location.href);
    url.searchParams.set('boardSizeFixture', String(n));
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, count);
}

test.describe('Board-size meter', () => {
  test.describe.configure({ timeout: 60_000 });

  test('a board with fewer than 50 objects says Smooth and shows the count', async ({ page }) => {
    await createArchitectureBoard(page);
    const meter = page.getByTestId('board-size-meter');
    await expect(meter).toBeVisible();
    await expect(meter).toHaveAttribute('data-state', 'Smooth');
    await expect(meter).toContainText('Smooth');
    const count = Number(await meter.getAttribute('data-object-count'));
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(50);
    await expect(meter).toContainText(`${count} objects · Smooth`);
    await expect(page.getByTestId('board-size-warn')).toHaveCount(0);

    await setEditorDsl(page, SMALLER_THEN_LARGER);
    await expect(page.getByTestId('rf__node-worker')).toBeVisible();
    await expect(meter).toHaveAttribute('data-state', 'Smooth');
    const nextCount = Number(await meter.getAttribute('data-object-count'));
    expect(nextCount).toBeGreaterThan(count);
    await expect(meter).toContainText(`${nextCount} objects · Smooth`);
  });

  test('a 1,000-object fixture shows the soft warn copy', async ({ page }) => {
    await createArchitectureBoard(page);
    await applyBoardSizeFixture(page, 1000);
    const meter = page.getByTestId('board-size-meter');
    await expect(meter).toHaveAttribute('data-state', 'Heavy');
    await expect(meter).toContainText('1,000 objects · Heavy');
    await expect(page.getByTestId('board-size-warn')).toHaveText(
      'This board is getting heavy (1,000+ objects). Editing may feel slower.',
    );
  });

  test('a 5,000-object fixture shows the Split me copy', async ({ page }) => {
    await createArchitectureBoard(page);
    await applyBoardSizeFixture(page, 5000);
    const meter = page.getByTestId('board-size-meter');
    await expect(meter).toHaveAttribute('data-state', 'Split me');
    await expect(meter).toContainText('5,000 objects · Split me');
    await expect(page.getByTestId('board-size-warn')).toHaveText(
      'Split me — 5,000+ objects. Move work to another board before a workshop.',
    );
  });
});
