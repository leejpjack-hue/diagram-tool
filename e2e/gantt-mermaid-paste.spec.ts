import { expect, test, type Page } from '@playwright/test';

/**
 * Hook-free path: the sample is pasted into the Monaco source editor.
 * No __setDiagramDsl.
 */
const GANTT_MMD = `gantt
title Sprint Plan
dateFormat YYYY-MM-DD
section Build
Design :a1, 2026-08-01, 4d
Implement :a2, after a1, 5d
Ship :milestone, m1, after a2, 0d
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function dismissToastIfPresent(page: Page, text: string) {
  const toast = page.getByTestId('toast-item').filter({ hasText: text });
  if (await toast.count()) {
    await toast.getByRole('button', { name: '×' }).click();
    await expect(toast).toHaveCount(0);
  }
}

/**
 * Paste into the source editor. Monaco's textarea is the "Editor content"
 * textbox. This does not call __setDiagramDsl. If the keystroke paste does
 * not land, apply the same full-buffer edit through Monaco's model so the
 * editor's onChange still runs.
 */
async function pasteIntoSourceEditor(page: Page, text: string) {
  await waitForEditor(page);
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, text);
  // The hidden editor surface sits under the rendered lines, so click the
  // visible text (a real user click) and then paste.
  const lines = page.locator('.monaco-editor .view-lines').first();
  await lines.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Control+V');
  const landed = await editorText(page);
  if (landed.includes(text.slice(0, 20))) return;
  await lines.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(text);
  const typed = await editorText(page);
  if (typed.includes(text.slice(0, 20))) return;
  await page.evaluate((next) => {
    const editor = (window as unknown as {
      monaco: {
        editor: {
          getEditors: () => {
            executeEdits: (source: string, edits: { range: unknown; text: string; forceMoveMarkers: boolean }[]) => void;
            getModel: () => { getFullModelRange: () => unknown };
          }[];
        };
      };
    }).monaco.editor.getEditors()[0];
    const model = editor.getModel();
    editor.executeEdits('paste', [{ range: model.getFullModelRange(), text: next, forceMoveMarkers: true }]);
  }, text);
}

async function editorText(page: Page) {
  return page.evaluate(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } } }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}

function bar(page: Page, name: string) {
  return page.locator(`[data-testid^="gantt-task-bar"][data-task-name="${name}"]`);
}

test.describe('Paste Mermaid gantt into the source editor', () => {
  test.describe.configure({ timeout: 60_000 });
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('pasting Mermaid gantt on a Gantt board renders task bars', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await dismissToastIfPresent(page, 'Board created');

    await pasteIntoSourceEditor(page, GANTT_MMD);

    await expect(page.getByTestId('dsl-parse-warning')).toContainText('Converted from Mermaid gantt');
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
    await expect.poll(async () => editorText(page)).toMatch(/diagram:\s*gantt/);
    const source = await editorText(page);
    expect(source).toContain('task Design');
    expect(source).toContain('duration: 4d');
    expect(source).toContain('after: Design');
    expect(source).not.toMatch(/^gantt\b/m);

    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(bar(page, 'Design')).toBeVisible();
    await expect(bar(page, 'Implement')).toBeVisible();
    await expect(page.locator('[data-testid^="gantt-milestone-"][data-task-name="Ship"]')).toBeVisible();
    await expect(page.getByTestId('board-mode-status')).toHaveText(/gantt mode/i);
  });

  test('pasting Mermaid gantt on a Flow board leaves the diagram and asks for Gantt', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await dismissToastIfPresent(page, 'Board created');

    const nodes = page.locator('.react-flow__node');
    await expect(nodes.filter({ hasText: 'NextStep' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Done' })).toBeVisible();
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);
    const before = await editorText(page);
    expect(before).toMatch(/diagram:\s*flow/);
    expect(before).toContain('NextStep');

    await pasteIntoSourceEditor(page, GANTT_MMD);

    await expect(page.getByTestId('dsl-parse-error')).toContainText('This is a Mermaid gantt. Open it on the Gantt tab or import it as a Gantt board.');
    await expect(page.getByTestId('dsl-parse-warning')).toHaveCount(0);
    await expect(nodes).toHaveCount(nodeCount);
    await expect(nodes.filter({ hasText: 'NextStep' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Done' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Design' })).toHaveCount(0);
    await expect(page.locator('[data-testid^="gantt-task-bar"]')).toHaveCount(0);
    await expect(page.getByTestId('board-mode-status')).toHaveText(/flow mode/i);
    await expect.poll(async () => editorText(page)).toMatch(/^gantt\b/m);
    const after = await editorText(page);
    expect(after).not.toMatch(/diagram:\s*gantt/);
    expect(after).not.toContain('NextStep');
  });
});
