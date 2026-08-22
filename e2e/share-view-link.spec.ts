import { expect, test, type Page } from '@playwright/test';

const BOARD_A_DSL = `diagram: architecture
title: Board A
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

const GANTT_DSL = `diagram: gantt
title: Board Gantt
start: 2026-08-01

task Design {
  start: 2026-08-01
  end: 2026-08-05
  progress: 40
  color: #6366f1
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
  await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
  await expect(page.getByTestId('rf__node-api')).toBeVisible();
}

test.describe('View-only share links', () => {
  test.describe.configure({ timeout: 90_000 });

  test('publish board A, view in a clean profile, revoke 404s, rotate replaces the token', async ({ page, browser }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await setEditorDsl(page, BOARD_A_DSL);
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Untitled architecture' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Board A');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Board A' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Board A' }).click();
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog', { name: 'Share Board A' })).toBeVisible();
    await expect(page.getByRole('dialog')).not.toContainText(/seats|members|billing/i);
    await page.getByTestId('share-publish').click();
    await expect(page.getByTestId('share-view-url')).toHaveValue(/\/view\/[A-Za-z0-9_-]{16,64}$/);
    const shareUrl = await page.getByTestId('share-view-url').inputValue();

    await expect(page.getByRole('heading', { name: 'Board A' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    const viewer = await browser.newContext();
    const viewerPage = await viewer.newPage();
    const opened = await viewerPage.goto(shareUrl);
    expect(opened?.status()).toBe(200);
    await expect(viewerPage.getByTestId('share-viewer-title')).toHaveText('Board A');
    await expect(viewerPage.getByTestId('share-viewer-node-count')).toHaveText('2');
    await expect(viewerPage.getByTestId('rf__node-gateway')).toBeVisible();
    await expect(viewerPage.getByTestId('rf__node-api')).toBeVisible();
    await expect(viewerPage.getByRole('button', { name: '⌂ Boards' })).toHaveCount(0);
    await expect(viewerPage.getByText('Editor')).toHaveCount(0);
    await expect(viewerPage.getByRole('button', { name: 'View deck' })).toHaveCount(0);
    await expect(viewerPage.locator('body')).not.toContainText(/seats|members|billing/i);

    await page.getByRole('button', { name: 'Actions for Board A' }).click();
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByTestId('share-rotate').click();
    await expect(page.getByTestId('share-view-url')).not.toHaveValue(shareUrl);
    const rotatedUrl = await page.getByTestId('share-view-url').inputValue();
    expect(rotatedUrl).toMatch(/\/view\/[A-Za-z0-9_-]{16,64}$/);

    const oldAfterRotate = await viewerPage.goto(shareUrl);
    expect(oldAfterRotate?.status()).toBe(404);
    await expect(viewerPage.getByText('This view link is gone')).toBeVisible();

    const rotatedView = await viewerPage.goto(rotatedUrl);
    expect(rotatedView?.status()).toBe(200);
    await expect(viewerPage.getByTestId('share-viewer-title')).toHaveText('Board A');
    await expect(viewerPage.getByTestId('share-viewer-node-count')).toHaveText('2');

    await page.getByTestId('share-revoke').click();
    await expect(page.getByTestId('share-publish')).toBeVisible();
    const afterRevoke = await viewerPage.goto(rotatedUrl);
    expect(afterRevoke?.status()).toBe(404);
    await expect(viewerPage.getByText('This view link is gone')).toBeVisible();

    await viewer.close();
    await expect(page.getByRole('heading', { name: 'Board A' })).toBeVisible();
  });

  test('published Gantt view link has editor and schedule controls disabled', async ({ page, browser }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');
    await page.evaluate(value => {
      (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
    }, GANTT_DSL);
    await expect(page.getByText('Design', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Untitled gantt' })).toBeVisible();

    await page.getByRole('button', { name: 'Actions for Untitled gantt' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Board Gantt');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.getByRole('button', { name: 'Actions for Board Gantt' }).click();
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByTestId('share-publish').click();
    await expect(page.getByTestId('share-view-url')).toHaveValue(/\/view\/[A-Za-z0-9_-]{16,64}$/);
    const shareUrl = await page.getByTestId('share-view-url').inputValue();

    const viewer = await browser.newContext();
    const viewerPage = await viewer.newPage();
    const opened = await viewerPage.goto(shareUrl);
    expect(opened?.status()).toBe(200);
    await expect(viewerPage.getByTestId('share-viewer-title')).toHaveText('Board Gantt');
    const canvas = viewerPage.getByTestId('gantt-canvas');
    await expect(canvas).toHaveAttribute('data-readonly', 'true');
    await expect(viewerPage.getByRole('button', { name: '⌂ Boards' })).toHaveCount(0);
    await expect(viewerPage.getByText('Editor')).toHaveCount(0);
    await expect(viewerPage.getByRole('button', { name: /add task/i })).toHaveCount(0);
    await expect(viewerPage.locator('input[type="range"]')).toHaveCount(0);
    await expect(viewerPage.getByLabel(/progress/i)).toHaveCount(0);
    await expect(viewerPage.locator('.cursor-ew-resize')).toHaveCount(0);

    const bar = viewerPage.getByTestId('gantt-bar-task-1');
    await expect(bar).toBeVisible();
    const startBefore = await bar.getAttribute('data-start');
    const progressBefore = await bar.getAttribute('data-progress');
    expect(progressBefore).toBe('40');
    const box = await bar.boundingBox();
    expect(box).toBeTruthy();
    await viewerPage.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await viewerPage.mouse.down();
    await viewerPage.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2, { steps: 8 });
    await viewerPage.mouse.up();
    await expect(bar).toHaveAttribute('data-start', startBefore!);
    await expect(bar).toHaveAttribute('data-progress', '40');

    await viewer.close();
  });
});
