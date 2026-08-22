import { expect, test, type Page } from '@playwright/test';

const ARCH_DSL = `diagram: architecture
title: Connector Guard
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

async function openDeck(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.getByRole('button', { name: 'View deck' }).click();
  await expect(page.getByRole('heading', { name: 'Frames' })).toBeVisible();
}

async function drawShape(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.getByRole('button', { name: 'Shapes (R)' }).click();
  await page.getByRole('button', { name: 'Rectangle' }).click();
  const box = await page.getByRole('main').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + x1, box!.y + y1);
  await page.mouse.down();
  await page.mouse.move(box!.x + x2, box!.y + y2, { steps: 8 });
  await page.mouse.up();
}

async function clickOnMain(page: Page, x: number, y: number) {
  const box = await page.getByRole('main').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + x, box!.y + y);
}

test.describe('Deck connector attachments', () => {
  test.describe.configure({ timeout: 60_000 });

  test('snaps a connector to two shapes, reflows on drag, and keeps bindings after reload', async ({ page }) => {
    await openDeck(page);
    await drawShape(page, 180, 140, 320, 240);
    await drawShape(page, 520, 140, 660, 240);

    await page.getByRole('button', { name: 'Connector (L)' }).click();
    await clickOnMain(page, 250, 190);
    await clickOnMain(page, 590, 190);

    const connector = page.getByTestId('deck-connector');
    await expect(connector).toBeVisible();
    await expect(connector).toHaveAttribute('data-start-id', /.+/);
    await expect(connector).toHaveAttribute('data-end-id', /.+/);
    const startId = await connector.getAttribute('data-start-id');
    const endId = await connector.getAttribute('data-end-id');
    expect(startId).toBeTruthy();
    expect(endId).toBeTruthy();
    expect(startId).not.toBe(endId);

    const before = await connector.boundingBox();
    expect(before).toBeTruthy();

    await page.getByRole('button', { name: 'Select (V)' }).click();
    const startShape = page.locator(`[data-item-id="${startId}"]`);
    await expect(startShape).toBeVisible();
    const startBox = await startShape.boundingBox();
    expect(startBox).toBeTruthy();
    await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(startBox!.x + startBox!.width / 2 + 140, startBox!.y + startBox!.height / 2 + 80, { steps: 10 });
    await page.mouse.up();

    await expect(connector).toHaveAttribute('data-start-id', startId!);
    await expect(connector).toHaveAttribute('data-end-id', endId!);
    const after = await connector.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.hypot((after!.x - before!.x), (after!.y - before!.y))).toBeGreaterThan(20);

    const startAfter = await startShape.boundingBox();
    const startHandle = await connector.locator('[data-endpoint="start"]').boundingBox();
    expect(startAfter).toBeTruthy();
    expect(startHandle).toBeTruthy();
    const nearest = Math.min(
      Math.abs(startHandle!.x + startHandle!.width / 2 - startAfter!.x),
      Math.abs(startHandle!.x + startHandle!.width / 2 - (startAfter!.x + startAfter!.width)),
      Math.abs(startHandle!.y + startHandle!.height / 2 - startAfter!.y),
      Math.abs(startHandle!.y + startHandle!.height / 2 - (startAfter!.y + startAfter!.height)),
    );
    expect(nearest).toBeLessThan(8);

    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Untitled architecture' }).click();
    await expect(page.getByRole('button', { name: 'View deck' })).toBeVisible();
    await page.getByRole('button', { name: 'View deck' }).click();
    await expect(page.getByTestId('deck-connector')).toHaveAttribute('data-start-id', startId!);
    await expect(page.getByTestId('deck-connector')).toHaveAttribute('data-end-id', endId!);
  });

  test('architecture connects: edges still render on a typed board', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
    await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');
    await page.evaluate(value => {
      (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
    }, ARCH_DSL);
    await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await expect(page.locator('.react-flow__edge').first()).toBeVisible();
  });
});
