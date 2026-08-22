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
    const shareUrl = await page.getByTestId('share-view-url').inputValue();
    expect(shareUrl).toMatch(/\/view\/[A-Za-z0-9_-]{16,64}$/);

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
    const rotatedUrl = await page.getByTestId('share-view-url').inputValue();
    expect(rotatedUrl).not.toBe(shareUrl);

    const oldAfterRotate = await viewerPage.goto(shareUrl);
    expect(oldAfterRotate?.status()).toBe(404);
    await expect(viewerPage.getByText('This view link is gone')).toBeVisible();

    const rotatedView = await viewerPage.goto(rotatedUrl);
    expect(rotatedView?.status()).toBe(200);
    await expect(viewerPage.getByTestId('share-viewer-title')).toHaveText('Board A');
    await expect(viewerPage.getByTestId('share-viewer-node-count')).toHaveText('2');

    await page.getByTestId('share-revoke').click();
    const afterRevoke = await viewerPage.goto(rotatedUrl);
    expect(afterRevoke?.status()).toBe(404);
    await expect(viewerPage.getByText('This view link is gone')).toBeVisible();

    await viewer.close();
    await expect(page.getByRole('heading', { name: 'Board A' })).toBeVisible();
  });
});
