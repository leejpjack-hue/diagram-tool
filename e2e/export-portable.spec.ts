import { expect, test, type Page } from '@playwright/test';
import { copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ARCH_DSL = `diagram: architecture
title: Portable Roundtrip
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
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void; getValue: () => string }[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function setEditorDsl(page: Page, dsl: string) {
  await waitForEditor(page);
  // DEV-only seam (import.meta.env.DEV). Production builds do not install it.
  await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');
  await page.evaluate(value => {
    (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
  }, dsl);
  await expect(page.getByText('Portable Roundtrip').first()).toBeVisible();
  await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
  await expect(page.getByTestId('rf__node-api')).toBeVisible();
}

async function createKnownArchitectureBoard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, ARCH_DSL);
  await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
  await expect(page.getByTestId('rf__node-api')).toBeVisible();
}

const FORMAT_LABEL: Record<'JSON' | 'PNG' | 'SVG', RegExp> = {
  JSON: /Structured data for tools/,
  PNG: /Crisp image for docs/,
  SVG: /Vector, free and portable/,
};

async function downloadFromExport(page: Page, format: 'JSON' | 'PNG' | 'SVG') {
  if (!await page.getByTestId('export-portable-copy').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
  }
  await expect(page.getByTestId('export-portable-copy')).toContainText('portable and free');
  await expect(page.getByTestId('export-portable-copy')).toContainText('no watermark');
  await page.getByRole('button', { name: FORMAT_LABEL[format] }).click();
  if (format === 'PNG') {
    await page.locator('.side-panel select').selectOption('2');
  }
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: `Download ${format}` }).click();
  return downloadPromise;
}

test.describe('Portable export and import', () => {
  test.describe.configure({ timeout: 60_000 });

  test('exports JSON of a known architecture board, then imports matching DSL and node count', async ({ page }) => {
    await createKnownArchitectureBoard(page);
    const download = await downloadFromExport(page, 'JSON');
    const downloaded = await download.path();
    expect(downloaded).toBeTruthy();
    const path = join(tmpdir(), `diagram-tool-board-${Date.now()}.json`);
    copyFileSync(downloaded!, path);
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      version: string;
      board: { source: { text: string }; nodes: unknown[]; frames: unknown[]; comments: unknown[] };
    };
    expect(payload.version).toBe('3.0');
    expect(payload.board.source.text).toBe(ARCH_DSL);
    expect(payload.board.nodes).toHaveLength(2);
    expect(payload.board.frames).toEqual([]);
    expect(payload.board.comments).toEqual([]);

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(path!);
    await expect(page.getByText(/Imported “Portable Roundtrip”/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Portable Roundtrip' })).toBeVisible();

    await page.getByRole('heading', { name: 'Portable Roundtrip' }).click();
    await waitForEditor(page);
    await expect(page.getByText('Portable Roundtrip').first()).toBeVisible();
    await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
  });

  test('PNG @2x and SVG download without a watermark', async ({ page }) => {
    await createKnownArchitectureBoard(page);

    const png = await downloadFromExport(page, 'PNG');
    expect(png.suggestedFilename()).toMatch(/\.png$/i);
    const pngPath = await png.path();
    expect(pngPath).toBeTruthy();
    expect(readFileSync(pngPath!).byteLength).toBeGreaterThan(100);
    expect(readFileSync(pngPath!).toString('utf8')).not.toMatch(/watermark/i);

    const svg = await downloadFromExport(page, 'SVG');
    expect(svg.suggestedFilename()).toMatch(/\.svg$/i);
    const svgText = readFileSync((await svg.path())!, 'utf8');
    expect(svgText).toMatch(/<svg/i);
    expect(svgText).not.toMatch(/watermark/i);
  });

  test('complete backup restores a Space and board after a clean profile', async ({ browser }) => {
    const source = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const page = await source.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await setEditorDsl(page, ARCH_DSL);
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: 'New Space' }).click();
    await page.getByPlaceholder('New Space name').fill('Platform Backup');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Actions for Untitled architecture' }).click();
    await page.getByRole('button', { name: 'Edit details' }).click();
    await page.getByLabel('Title', { exact: true }).fill('Backup Core API');
    await page.locator('[role="dialog"] select').selectOption({ label: 'Platform Backup' });
    await page.getByRole('button', { name: 'Save changes' }).click();

    await page.getByRole('button', { name: 'Local storage' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-complete-backup').click();
    const backup = await downloadPromise;
    const backupPath = await backup.path();
    expect(backupPath).toBeTruthy();
    const stableBackup = join(tmpdir(), `diagram-tool-backup-${Date.now()}.boards.json`);
    copyFileSync(backupPath!, stableBackup);
    const payload = JSON.parse(readFileSync(stableBackup, 'utf8')) as {
      spaces: Array<{ name: string }>;
      boards: Array<{ title: string }>;
      templates: unknown[];
      versions: unknown[];
    };
    expect(payload.spaces.some(space => space.name === 'Platform Backup')).toBe(true);
    expect(payload.boards.some(board => board.title === 'Backup Core API')).toBe(true);
    expect(Array.isArray(payload.templates)).toBe(true);
    expect(Array.isArray(payload.versions)).toBe(true);
    await source.close();

    const clean = await browser.newContext({ baseURL: 'http://localhost:5173' });
    const restored = await clean.newPage();
    await restored.goto('/');
    await expect(restored.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(restored.getByRole('heading', { name: 'Backup Core API' })).toHaveCount(0);

    const [fileChooser] = await Promise.all([
      restored.waitForEvent('filechooser'),
      restored.getByTestId('dashboard-import').click(),
    ]);
    await fileChooser.setFiles(stableBackup);
    await expect(restored.getByRole('heading', { name: 'Backup Core API' })).toBeVisible();
    await expect(restored.getByRole('button', { name: /Platform Backup/ })).toBeVisible();
    await clean.close();
  });
});
