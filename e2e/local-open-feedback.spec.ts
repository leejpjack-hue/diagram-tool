import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Chooser proof arms page.waitForEvent('filechooser') before the click.
 * locator.setInputFiles and an empty FileList are ingestion or synthetic
 * cancellation only. AbortError is a synthetic picker cancellation.
 * Native OS dialog dismissal is not automated here.
 */

const ARCH_DSL = `diagram: architecture
title: Local Open Architecture
direction: LR

service API {
  color: "#6366f1"
}
database DB {
  color: "#a855f7"
}
edge API -> DB { label: "reads" }
`;

const FLOW_DSL = `diagram: flow
title: Local Open Flow
direction: LR

start Start
Start ->|check| Review
Review -> Done
end Done
`;

function boardDocument(mode: 'architecture' | 'flow', title: string, dsl: string) {
  const architecture = mode === 'architecture';
  return {
    version: '3.0',
    kind: 'board',
    exportedAt: '2026-11-07T00:00:00.000Z',
    board: {
      id: `local-open-${mode}`,
      title,
      description: '',
      mode,
      dslText: dsl,
      source: { kind: 'dsl', text: dsl },
      nodes: architecture
        ? [{ id: 'api', name: 'API', type: 'service' }, { id: 'db', name: 'DB', type: 'database' }]
        : [
            { id: 'start', name: 'Start', type: 'start' },
            { id: 'review', name: 'Review', type: 'flow' },
            { id: 'done', name: 'Done', type: 'end' },
          ],
      edges: architecture
        ? [{ id: 'api_to_db', from: 'api', to: 'db', label: 'reads' }]
        : [
            { id: 'start_to_review', from: 'start', to: 'review', label: 'check' },
            { id: 'review_to_done', from: 'review', to: 'done' },
          ],
      frames: [],
      comments: [],
      layout: {
        pins: architecture
          ? { api: { x: 40, y: 80 }, db: { x: 280, y: 80 } }
          : { start: { x: 40, y: 80 }, review: { x: 220, y: 80 }, done: { x: 400, y: 80 } },
      },
    },
  };
}

function writeJson(name: string, value: unknown): string {
  const path = join(tmpdir(), `diagram-tool-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

function writeText(name: string, text: string, extension: string): string {
  const path = join(tmpdir(), `diagram-tool-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  writeFileSync(path, text);
  return path;
}

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function closeToast(page: Page, text: string) {
  const toast = page.getByTestId('toast-item').filter({ hasText: text });
  await expect(toast).toBeVisible();
  await toast.getByRole('button', { name: '×' }).click();
  await expect(toast).toHaveCount(0);
}

async function chooseFile(page: Page, open: () => Promise<void>, path: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    open(),
  ]);
  await chooser.setFiles(path);
}

async function openBlankArchitecture(page: Page) {
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByText('title: Untitled Architecture')).toBeVisible();
}

async function downloadBoard(page: Page) {
  if (!await page.getByTestId('export-portable-copy').isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
  }
  await page.getByRole('button', { name: /Structured data for tools/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const download = await downloadPromise;
  const saved = await download.path();
  expect(saved).toBeTruthy();
  const path = join(tmpdir(), `diagram-tool-reopen-${Date.now()}.json`);
  copyFileSync(saved!, path);
  return path;
}

function expectRoundTrip(path: string, mode: 'architecture' | 'flow', title: string, dsl: string) {
  const saved = JSON.parse(readFileSync(path, 'utf8')) as {
    version: string;
    kind: string;
    board: {
      mode: string;
      title: string;
      dslText: string;
      source: { kind: string; text: string };
      nodes: Array<{ id: string }>;
      edges: Array<{ label?: string }>;
      layout: { pins: Record<string, { x: number; y: number }> };
    };
  };
  expect(saved.version).toBe('3.0');
  expect(saved.kind).toBe('board');
  expect(saved.board.mode).toBe(mode);
  expect(saved.board.title).toBe(title);
  expect(saved.board.dslText).toBe(dsl);
  expect(saved.board.source).toEqual({ kind: 'dsl', text: dsl });
  const ids = mode === 'architecture' ? ['api', 'db'] : ['start', 'review', 'done'];
  expect(saved.board.nodes.map(node => node.id).sort()).toEqual([...ids].sort());
  if (mode === 'architecture') expect(saved.board.edges.some(edge => edge.label === 'reads')).toBe(true);
  else expect(saved.board.edges.some(edge => edge.label === 'check')).toBe(true);
  ids.forEach(id => {
    expect(typeof saved.board.layout.pins[id]?.x).toBe('number');
    expect(typeof saved.board.layout.pins[id]?.y).toBe('number');
  });
}

async function installReadStall(page: Page) {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = function text() {
      const read = original.call(this);
      return read.then(value => {
        const stall = (window as unknown as { __fileReadStall?: Promise<void> }).__fileReadStall;
        return stall ? stall.then(() => value) : value;
      });
    };
  });
}

async function holdFileReads(page: Page) {
  await page.evaluate(() => {
    let release: () => void = () => {};
    (window as unknown as { __fileReadStall?: Promise<void> }).__fileReadStall = new Promise<void>(resolve => {
      release = resolve;
    });
    (window as unknown as { __releaseFileRead?: () => void }).__releaseFileRead = () => release();
  });
}

async function releaseFileReads(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __releaseFileRead: () => void }).__releaseFileRead();
  });
}

test.describe('Local board open and import', () => {
  test.describe.configure({ timeout: testTimeout(90_000) });

  test('dashboard Import click opens a chooser, then the card opens an editable architecture board', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = writeJson('arch', boardDocument('architecture', 'Local Open Architecture', ARCH_DSL));

    await chooseFile(page, () => page.getByTestId('dashboard-import').click(), path);

    await expect(page.getByTestId('toast-item').filter({ hasText: 'Imported “Local Open Architecture”' })).toHaveAttribute('role', 'status');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await closeToast(page, 'Imported “Local Open Architecture”');
    await page.getByRole('heading', { name: 'Local Open Architecture' }).click();
    await waitForEditor(page);
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await expect(page.getByTestId('rf__node-db')).toBeVisible();
    await expect(page.getByText('title: Local Open Architecture')).toBeVisible();

    const saved = await downloadBoard(page);
    expectRoundTrip(saved, 'architecture', 'Local Open Architecture', ARCH_DSL);

    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), saved);
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Opened "Local Open Architecture"' })).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await expect(page.getByTestId('rf__node-db')).toBeVisible();
    await expect(page.getByTestId('rf__edge-api_to_db_0').getByText('reads')).toBeVisible();
  });

  test('keyboard Import opens a chooser for an editable flow board', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = writeJson('flow', boardDocument('flow', 'Local Open Flow', FLOW_DSL));
    await page.getByTestId('dashboard-import').focus();
    await chooseFile(page, () => page.keyboard.press('Enter'), path);
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Imported “Local Open Flow”' })).toHaveAttribute('role', 'status');
    await closeToast(page, 'Imported “Local Open Flow”');
    await page.getByRole('heading', { name: 'Local Open Flow' }).click();
    await waitForEditor(page);
    await expect(page.getByTestId('rf__node-start')).toBeVisible();
    await expect(page.getByTestId('rf__node-review')).toBeVisible();
    await expect(page.getByTestId('rf__node-done')).toBeVisible();
    await expect(page.getByText('title: Local Open Flow')).toBeVisible();
    const saved = await downloadBoard(page);
    expectRoundTrip(saved, 'flow', 'Local Open Flow', FLOW_DSL);
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Local Open Flow' }).click();
    await waitForEditor(page);
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), saved);
    await expect(page.getByTestId('rf__node-review')).toBeVisible();
    await expect(page.getByText('check').first()).toBeVisible();
  });

  test('File Open click opens a chooser while the picker API is still present', async ({ page }) => {
    await page.goto('/app/');
    await openBlankArchitecture(page);
    const path = writeJson('arch-open', boardDocument('architecture', 'Local Open Architecture', ARCH_DSL));
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), path);
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Opened "Local Open Architecture"' })).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await expect(page.getByText('title: Local Open Architecture')).toBeVisible();
  });

  test('File Open falls back to the hidden input when the picker API is absent', async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
      delete host.showOpenFilePicker;
      delete host.showSaveFilePicker;
    });
    await page.goto('/app/');
    await openBlankArchitecture(page);
    const path = writeJson('flow-open', boardDocument('flow', 'Local Open Flow', FLOW_DSL));
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), path);
    await expect(page.getByTestId('rf__node-start')).toBeVisible();
    await expect(page.getByTestId('rf__node-done')).toBeVisible();
    await expect(page.getByText('title: Local Open Flow')).toBeVisible();
  });

  test('setInputFiles covers ingestion only and is not the chooser gesture', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const path = writeJson('ingest', boardDocument('architecture', 'Local Open Architecture', ARCH_DSL));
    await page.getByTestId('dashboard-import-file').setInputFiles(path);
    await expect(page.getByRole('heading', { name: 'Local Open Architecture' })).toBeVisible();
    await page.getByRole('heading', { name: 'Local Open Architecture' }).click();
    await waitForEditor(page);
    await page.getByTestId('open-board-file').setInputFiles(writeJson('ingest-open', boardDocument('flow', 'Local Open Flow', FLOW_DSL)));
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Opened "Local Open Flow"' })).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('rf__node-review')).toBeVisible();
  });

  test('malformed, non-board, executable, and remote bait files leave the dashboard unchanged', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', request => urls.push(request.url()));
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await chooseFile(page, () => page.getByTestId('dashboard-import').click(), writeText('bad', '{', 'json'));
    await expect(page.getByTestId('toast-item').last()).toHaveAttribute('role', 'alert');
    await expect(page.getByText('No boards here yet')).toBeVisible();
    await closeToast(page, "That file isn't a valid board file.");

    await chooseFile(
      page,
      () => page.getByTestId('dashboard-import').click(),
      writeJson('wrong-kind', { version: '9.9', kind: 'playlist' }),
    );
    await expect(page.getByTestId('toast-item').last()).toHaveAttribute('role', 'alert');
    await expect(page.getByText('No boards here yet')).toBeVisible();

    await chooseFile(
      page,
      () => page.getByTestId('dashboard-import').click(),
      writeText('script', '<script>window.__localOpenPwned = true</script>', 'html'),
    );
    await expect(page.getByText('No boards here yet')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __localOpenPwned?: boolean }).__localOpenPwned)).toBeUndefined();

    await chooseFile(
      page,
      () => page.getByTestId('dashboard-import').click(),
      writeText('url', 'https://remote-bait.example/board.json', 'txt'),
    );
    await expect(page.getByText('No boards here yet')).toBeVisible();
    expect(urls.some(url => url.includes('remote-bait.example'))).toBe(false);
  });

  test('File Open keeps the current board for malformed, old-version, executable, and remote bait files', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', request => urls.push(request.url()));
    await page.goto('/app/');
    await openBlankArchitecture(page);

    const reject = async (path: string) => {
      await page.getByRole('button', { name: 'File', exact: true }).click();
      await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), path);
      await expect(page.getByTestId('toast-item').last()).toHaveAttribute('role', 'alert');
      await expect(page.getByText('title: Untitled Architecture')).toBeVisible();
      await expect(page.getByRole('button', { name: 'File', exact: true })).toBeFocused();
    };

    await reject(writeText('bad-open', '{', 'json'));
    await reject(writeJson('old-open', {
      version: '2.0',
      kind: 'board',
      board: { title: 'Old', mode: 'flow', dslText: 'diagram: flow\nstart A' },
    }));
    await reject(writeText('script-open', '<script>window.__localOpenPwned = true</script>', 'html'));
    await reject(writeText('url-open', 'https://remote-bait.example/open.json', 'txt'));
    expect(await page.evaluate(() => (window as unknown as { __localOpenPwned?: boolean }).__localOpenPwned)).toBeUndefined();
    expect(urls.some(url => url.includes('remote-bait.example'))).toBe(false);
  });

  test('synthetic empty FileList cancels without a native dialog dismissal', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByTestId('dashboard-import-file').evaluate(node => {
      const input = node as HTMLInputElement;
      input.files = new DataTransfer().files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByTestId('dashboard-import-status')).toHaveText('File selection cancelled.');
    await expect(page.getByText('No boards here yet')).toBeVisible();

    await openBlankArchitecture(page);
    await page.getByTestId('open-board-file').evaluate(node => {
      const input = node as HTMLInputElement;
      input.files = new DataTransfer().files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.getByTestId('file-open-status')).toHaveText('File selection cancelled.');
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();
    await expect(page.getByRole('button', { name: 'File', exact: true })).toBeFocused();
  });

  test('importing the same file twice adds two boards, and opening the same id replaces one', async ({ page }) => {
    await page.goto('/app/');
    const path = writeJson('twice', boardDocument('architecture', 'Local Open Architecture', ARCH_DSL));
    await chooseFile(page, () => page.getByTestId('dashboard-import').click(), path);
    await closeToast(page, 'Imported “Local Open Architecture”');
    await chooseFile(page, () => page.getByTestId('dashboard-import').click(), path);
    await closeToast(page, 'Imported “Local Open Architecture”');
    await expect(page.getByRole('heading', { name: 'Local Open Architecture' })).toHaveCount(2);
    await page.getByRole('heading', { name: 'Local Open Architecture' }).first().click();
    await waitForEditor(page);
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('heading', { name: 'Local Open Architecture' }).first().click();
    await waitForEditor(page);
    const fixed = writeJson('same-id', boardDocument('flow', 'Local Open Flow', FLOW_DSL));
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), fixed);
    await closeToast(page, 'Opened "Local Open Flow"');
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), fixed);
    await expect(page.getByTestId('rf__node-review')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Local Open Flow' })).toHaveCount(1);
  });

  test('a stalled read does not apply after a newer dashboard selection', async ({ page }) => {
    await installReadStall(page);
    await page.goto('/app/');
    await openBlankArchitecture(page);
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await holdFileReads(page);
    const path = writeJson('stale-import', boardDocument('flow', 'Local Open Flow', FLOW_DSL));
    const chooser = chooseFile(page, () => page.getByTestId('dashboard-import').click(), path);
    await chooser;
    await page.getByRole('heading', { name: 'Untitled Architecture' }).hover();
    await page.getByRole('checkbox', { name: 'Select Untitled Architecture' }).check();
    await releaseFileReads(page);
    await expect(page.getByTestId('dashboard-import-status')).toHaveText('The workspace changed, so that file was not applied.');
    await expect(page.getByRole('heading', { name: 'Local Open Flow' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Untitled Architecture' })).toBeVisible();
  });

  test('a stalled File Open does not replace the board after a selection or a round trip away', async ({ page }) => {
    await installReadStall(page);
    await page.goto('/app/');
    await openBlankArchitecture(page);
    await holdFileReads(page);
    const path = writeJson('stale-open', boardDocument('flow', 'Local Open Flow', FLOW_DSL));
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), path);
    await page.getByTestId('rf__node-firstservice').click();
    await releaseFileReads(page);
    await expect(page.getByTestId('file-open-status')).toHaveText('The workspace changed, so that file was not applied.');
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();
    await expect(page.getByText('title: Local Open Flow')).toHaveCount(0);

    await holdFileReads(page);
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await chooseFile(page, () => page.getByRole('button', { name: 'Open…' }).click(), path);
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Untitled Architecture' }).click();
    await waitForEditor(page);
    await releaseFileReads(page);
    await expect(page.getByTestId('file-open-status')).toHaveText('The workspace changed, so that file was not applied.');
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();
  });
});
