import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Documented canvas edits that write back into the typed source:
// - Move: drag snaps to the 10px grid, then `at:` is the layout constraint.
//   Flow pins only the moved step. Architecture pins every graph node.
// - Relabel: F2 writes the words on the shape. Flow updates `label:` and
//   keeps the step id on arrows. Architecture renames the node token.
// Sequence stays Mermaid. A participant rename updates the alias in place
// and does not grow an `at:` or native `diagram:` source.

const FLOW_DSL = `diagram: flow
title: Canvas Flow
direction: TB
Ask -> Send
node Ask {
  label: "Human ask"
}
node Send {
  label: Send
}`;

const ARCH_DSL = `diagram: architecture
title: Canvas Architecture
service Gateway {
  at: 40, 100
  connects: API
}
service API {
  at: 320, 100
}`;

const SEQUENCE_MMD = `sequenceDiagram
title Canvas Sequence
participant U as User
participant A as API
U->>A: GET /orders
A-->>U: 200 OK
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
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

async function openBlank(page: Page, kind: 'Workflow' | 'Architecture' | 'Sequence') {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: `Blank ${kind} Open a clean DSL canvas.` }).click();
  await waitForEditor(page);
}

async function dragNode(page: Page, testId: string, dx: number, dy: number) {
  const node = page.getByTestId(testId);
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width * 0.55;
  const y = box!.y + box!.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 20 });
  await page.mouse.up();
}

  async function renameOnCanvas(page: Page, testId: string, next: string) {
    const node = page.getByTestId(testId);
    await node.click();
    await expect(node).toHaveClass(/selected/);
    await page.keyboard.press('F2');
    const input = page.getByTestId('canvas-rename-input');
    await expect(input).toBeVisible();
    await input.fill(next);
    await input.press('Enter');
  }

async function disableFilePickers(page: Page) {
  await page.evaluate(() => {
    const host = window as unknown as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
    delete host.showOpenFilePicker;
    delete host.showSaveFilePicker;
  });
}

async function saveBoardDownload(page: Page) {
  await disableFilePickers(page);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  const saved = await download.path();
  expect(saved).toBeTruthy();
  const path = join(tmpdir(), `diagram-tool-canvas-source-${Date.now()}.json`);
  copyFileSync(saved!, path);
  return path;
}

async function openSavedBoard(page: Page, path: string) {
  await disableFilePickers(page);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Open…' }).click(),
  ]);
  await chooser.setFiles(path);
}

test.describe('Canvas edits stay in the typed source', () => {
  test.describe.configure({ timeout: testTimeout(90_000) });

  test('flow move and relabel update the editor, then Save opens the same board', async ({ page }) => {
    await openBlank(page, 'Workflow');
    await setEditorDsl(page, FLOW_DSL);
    await expect(page.getByTestId('rf__node-ask')).toBeVisible();
    await expect(page.getByText('Human ask', { exact: true })).toBeVisible();
    await page.getByTestId('fit-to-screen').click();
    await page.waitForTimeout(450);

    const before = await getEditorDsl(page);
    await dragNode(page, 'rf__node-ask', 180, 140);
    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).not.toBe(before);
    const moved = await getEditorDsl(page);
    const pin = moved.match(/node Ask \{[\s\S]*?at:\s*(-?\d+),\s*(-?\d+)/);
    expect(pin).toBeTruthy();
    expect(Number(pin![1]) % 10).toBe(0);
    expect(Number(pin![2]) % 10).toBe(0);
    expect(moved).toContain('Ask -> Send');
    expect(moved).not.toMatch(/node Send \{[^}]*at:/);

    await renameOnCanvas(page, 'rf__node-ask', 'Person asks');
    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).toContain('label: "Person asks"');
    const labeled = await getEditorDsl(page);
    expect(labeled).toContain('Ask -> Send');
    expect(labeled).not.toContain('node Person');
    await expect(page.getByText('Person asks', { exact: true })).toBeVisible();
    await expect(page.getByTestId('rf__node-ask')).toBeVisible();

    const path = await saveBoardDownload(page);
    const saved = JSON.parse(readFileSync(path, 'utf8')) as {
      version: string;
      kind: string;
      board: { mode: string; dslText: string; source: { text: string } };
    };
    expect(saved.version).toBe('3.0');
    expect(saved.kind).toBe('board');
    expect(saved.board.mode).toBe('flow');
    expect(saved.board.dslText).toContain('label: "Person asks"');
    expect(saved.board.dslText).toMatch(/at:\s*-?\d+,\s*-?\d+/);
    expect(saved.board.source.text).toBe(saved.board.dslText);

    await openSavedBoard(page, path);
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Opened "Canvas Flow"' })).toBeVisible();
    await expect(page.getByTestId('rf__node-ask')).toBeVisible();
    await expect(page.getByText('Person asks', { exact: true })).toBeVisible();
    await expect.poll(async () => getEditorDsl(page)).toContain('label: "Person asks"');
    await expect.poll(async () => getEditorDsl(page)).toContain('Ask -> Send');
  });

  test('architecture move and rename update the editor, then Save opens the same board', async ({ page }) => {
    await openBlank(page, 'Architecture');
    await setEditorDsl(page, ARCH_DSL);
    await expect(page.getByTestId('rf__node-gateway')).toBeVisible();
    await page.getByTestId('fit-to-screen').click();
    await page.waitForTimeout(450);

    const before = await getEditorDsl(page);
    await dragNode(page, 'rf__node-gateway', 200, 120);
    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).not.toBe(before);
    const moved = await getEditorDsl(page);
    expect(moved).toMatch(/service Gateway \{[\s\S]*at:\s*-?\d+,\s*-?\d+/);
    expect(moved).toMatch(/service API \{[\s\S]*at:\s*-?\d+,\s*-?\d+/);

    await renameOnCanvas(page, 'rf__node-gateway', 'Edge');
    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).toContain('service Edge');
    const renamed = await getEditorDsl(page);
    expect(renamed).not.toContain('service Gateway');
    expect(renamed).toContain('connects: API');
    await expect(page.getByTestId('rf__node-edge')).toBeVisible();
    await expect(page.getByText('Edge', { exact: true }).first()).toBeVisible();

    const path = await saveBoardDownload(page);
    const saved = JSON.parse(readFileSync(path, 'utf8')) as {
      board: { mode: string; dslText: string; source: { text: string } };
    };
    expect(saved.board.mode).toBe('architecture');
    expect(saved.board.dslText).toContain('service Edge');
    expect(saved.board.source.text).toBe(saved.board.dslText);

    await openSavedBoard(page, path);
    await expect(page.getByTestId('toast-item').filter({ hasText: 'Opened "Canvas Architecture"' })).toBeVisible();
    await expect(page.getByTestId('rf__node-edge')).toBeVisible();
    await expect(page.getByTestId('rf__node-api')).toBeVisible();
    await expect.poll(async () => getEditorDsl(page)).toContain('service Edge');
  });

  test('sequence canvas rename stays Mermaid and does not grow a position source', async ({ page }) => {
    await openBlank(page, 'Sequence');
    await setEditorDsl(page, SEQUENCE_MMD);
    await expect(page.getByText('GET /orders').first()).toBeVisible();
    const before = await getEditorDsl(page);
    expect(before).toMatch(/^\s*sequenceDiagram/m);
    expect(before).not.toMatch(/\bat:/);
    expect(before).not.toMatch(/^\s*diagram:/m);

    await page.locator('[data-seq-participant="U"]').first().click();
    const input = page.getByRole('textbox', { name: 'Rename participant' });
    await expect(input).toBeVisible();
    await input.fill('Customer');
    await input.press('Enter');

    await expect.poll(async () => getEditorDsl(page), { timeout: 10_000 }).toContain('participant U as Customer');
    const after = await getEditorDsl(page);
    expect(after).toMatch(/^\s*sequenceDiagram/m);
    expect(after).toContain('U->>A: GET /orders');
    expect(after).not.toMatch(/\bat:/);
    expect(after).not.toMatch(/^\s*diagram:/m);
    await expect(page.getByText('Customer').first()).toBeVisible();
  });
});
