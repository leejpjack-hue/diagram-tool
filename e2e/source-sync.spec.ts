import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ARCH_DSL = `diagram: architecture
title: Source Sync
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

const ARCH_WITH_WORKER = `diagram: architecture
title: Source Sync
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

const BAD_DSL = `diagram: architecture
title: Source Sync
service Gateway {
  at: 40, 100
  connects: API
`;

const SEQUENCE_MMD = `sequenceDiagram
title Imported Sequence
participant U as User
participant A as API
U->>A: GET /orders
A-->>U: 200 OK
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
    const hooked = (window as unknown as { __getDiagramDsl?: () => string }).__getDiagramDsl;
    if (typeof hooked === 'function') return hooked();
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } } }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}

async function createArchitectureBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, ARCH_DSL);
  await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
  await expect(page.getByTestId('rf__node-api')).toBeVisible();
}

test.describe('Bidirectional source sync', () => {
  test.describe.configure({ timeout: 60_000 });

  test('edit DSL → node appears', async ({ page }) => {
    await createArchitectureBoard(page);
    await setEditorDsl(page, ARCH_WITH_WORKER);
    await expect(page.getByTestId('rf__node-worker')).toBeVisible();
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
  });

  test('drag node → DSL text changes', async ({ page }) => {
    await createArchitectureBoard(page);
    const before = await getEditorDsl(page);
    const node = page.getByTestId('rf__node-gateway');
    const box = await node.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + 140, box!.y + 90, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => getEditorDsl(page)).not.toBe(before);
    const after = await getEditorDsl(page);
    expect(after).toMatch(/service Gateway \{[\s\S]*at:/);
    expect(after).not.toBe(before);
  });

  test('bad DSL shows an error and keeps the last graph', async ({ page }) => {
    await createArchitectureBoard(page);
    await setEditorDsl(page, BAD_DSL);
    await expect(page.getByTestId('dsl-parse-error')).toBeVisible();
    await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
  });

  test('import a sequenceDiagram file from the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = join(tmpdir(), `diagram-tool-sequence-${Date.now()}.mmd`);
    writeFileSync(path, SEQUENCE_MMD);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path);
    await expect(page.getByText(/Imported “Imported Sequence”/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Imported Sequence' })).toBeVisible();

    await page.getByRole('heading', { name: 'Imported Sequence' }).click();
    await waitForEditor(page);
    await expect(page.getByText('Imported Sequence').first()).toBeVisible();
    await expect(page.getByText('User').first()).toBeVisible();
    await expect(page.getByText('GET /orders').first()).toBeVisible();
  });
});
