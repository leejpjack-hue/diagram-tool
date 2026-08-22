import { expect, test, type Page } from '@playwright/test';

const ARCH_DSL = `diagram: architecture
title: Train Arch Offline
service API`;
const FLOW_DSL = `diagram: flow
title: Train Flow Offline
start A`;
const SEQUENCE_DSL = `sequenceDiagram
Alice->>Bob: train-offline`;
const ARCH_OFFLINE_DSL = `diagram: architecture
title: Train Arch Offline Edited
service API`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void }[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function setEditorDsl(page: Page, dsl: string) {
  await waitForEditor(page);
  await page.evaluate(value => {
    const editor = (window as unknown as { monaco: { editor: { getEditors: () => { setValue: (next: string) => void }[] } } }).monaco.editor.getEditors()[0];
    editor.setValue(value);
  }, dsl);
  await expect(page.getByText(dsl.split('\n')[1])).toBeVisible();
}

async function createEditedBoard(page: Page, starter: RegExp, dsl: string) {
  await page.getByRole('button', { name: starter }).click();
  await setEditorDsl(page, dsl);
  await page.getByRole('button', { name: '⌂ Boards' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

async function warmOfflineShell(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const urls = new Set<string>([`${location.origin}/`, `${location.origin}/manifest.webmanifest`, `${location.origin}/favicon.svg`]);
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.name.startsWith(location.origin)) urls.add(entry.name);
    }
    document.querySelectorAll('script[src], link[href]').forEach(element => {
      const url = (element as HTMLScriptElement).src || (element as HTMLLinkElement).href;
      if (url.startsWith(location.origin)) urls.add(url);
    });
    const cache = await caches.open('diagram-tool-shell-v2');
    for (const url of urls) {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response.clone());
    }
  });
}

test.use({ baseURL: 'http://127.0.0.1:4173' });

test.describe('Durable local-first workspace', () => {
  test('keeps last 3 edited boards and a named checkpoint offline after reload', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);

    await createEditedBoard(page, /Blank Architecture/, ARCH_DSL);
    await createEditedBoard(page, /Blank Workflow/, FLOW_DSL);
    await createEditedBoard(page, /Blank Sequence/, SEQUENCE_DSL);

    await expect(page.getByRole('heading', { name: 'Untitled architecture' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled sequence' })).toBeVisible();

    page.once('dialog', dialog => dialog.accept('Before train ride'));
    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Version history' }).click();
    await page.getByRole('button', { name: 'Create checkpoint' }).click();
    await expect(page.getByText('Before train ride')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await warmOfflineShell(page);
    await context.setOffline(true);
    await page.getByRole('heading', { name: 'Untitled architecture' }).click();
    await setEditorDsl(page, ARCH_OFFLINE_DSL);
    await expect(page.getByTestId('offline-banner')).toHaveText('offline — changes on this device.');
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('offline-banner')).toHaveText('offline — changes on this device.');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Untitled architecture' })).toBeVisible();

    await page.getByRole('heading', { name: 'Untitled architecture' }).click();
    await expect(page.getByText('Train Arch Offline Edited')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await page.getByRole('heading', { name: 'Untitled flow' }).click();
    await expect(page.getByText('Train Flow Offline')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await page.getByRole('heading', { name: 'Untitled sequence' }).click();
    await expect(page.getByText('train-offline')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();

    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.getByText('Before train ride')).toBeVisible();
    await expect(page.getByText(/· Named checkpoint/)).toBeVisible();
  });
});
