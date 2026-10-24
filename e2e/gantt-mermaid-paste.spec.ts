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

const SEQUENCE_MMD = `sequenceDiagram
title Checkout Flow
participant U as User
participant A as API
U->>A: GET /orders
A-->>U: 200 OK
`;

const FLOW_MMD = `flowchart LR
title: Checkout
  Intake[Intake] --> Review[Review]
  Review --> Done[Done]
`;

const UNSUPPORTED_MMD = `erDiagram
  CUSTOMER ||--o{ ORDER : places
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

  test('pasting Mermaid gantt on a Flow board auto-switches to Gantt mode and renders task bars', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await dismissToastIfPresent(page, 'Board created');

    const nodes = page.locator('.react-flow__node');
    await expect(nodes.filter({ hasText: 'NextStep' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Done' })).toBeVisible();
    await expect(page.getByTestId('board-mode-status')).toHaveText(/flow mode/i);

    await pasteIntoSourceEditor(page, GANTT_MMD);

    await expect(page.getByTestId('dsl-parse-warning')).toContainText('Converted from Mermaid gantt');
    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('board-mode-status')).toHaveText(/gantt mode/i);
    await expect(page.getByRole('button', { name: 'Gantt', exact: true })).toHaveClass(/active/);
    await expect.poll(async () => editorText(page)).toMatch(/diagram:\s*gantt/);
    const after = await editorText(page);
    expect(after).toContain('task Design');
    expect(after).toContain('duration: 4d');
    expect(after).toContain('after: Design');
    expect(after).not.toMatch(/^gantt\b/m);

    await page.getByRole('button', { name: 'Day', exact: true }).click();
    await expect(bar(page, 'Design')).toBeVisible();
    await expect(bar(page, 'Implement')).toBeVisible();
    await expect(page.locator('[data-testid^="gantt-milestone-"][data-task-name="Ship"]')).toBeVisible();
  });

  test('pasting sequenceDiagram and flowchart on wrong boards auto-switches to the matching mode', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Gantt Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await dismissToastIfPresent(page, 'Board created');
    await expect(page.getByTestId('board-mode-status')).toHaveText(/gantt mode/i);

    await pasteIntoSourceEditor(page, SEQUENCE_MMD);

    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('board-mode-status')).toHaveText(/sequence/i);
    await expect(page.getByRole('button', { name: 'Sequence', exact: true })).toHaveClass(/active/);
    await expect(page.locator('.sequence-canvas').getByText('User').first()).toBeVisible();
    await expect(page.locator('.sequence-canvas').getByText('GET /orders').first()).toBeVisible();

    await pasteIntoSourceEditor(page, FLOW_MMD);

    await expect(page.getByTestId('dsl-parse-error')).toHaveCount(0);
    await expect(page.getByTestId('board-mode-status')).toHaveText(/flow mode/i);
    await expect(page.getByRole('button', { name: 'Flow', exact: true })).toHaveClass(/active/);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.filter({ hasText: 'Intake' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Review' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Done' })).toBeVisible();
  });

  test('pasting an unknown Mermaid type rejects naming the type and keeps the board unchanged', async ({ page }) => {
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

    await pasteIntoSourceEditor(page, UNSUPPORTED_MMD);

    await expect(page.getByTestId('dsl-parse-error')).toContainText("Mermaid erDiagram isn't supported yet.");
    await expect(page.getByTestId('dsl-parse-warning')).toHaveCount(0);
    await expect(page.getByTestId('board-mode-status')).toHaveText(/flow mode/i);
    await expect(page.getByRole('button', { name: 'Flow', exact: true })).toHaveClass(/active/);
    await expect(nodes).toHaveCount(nodeCount);
    await expect(nodes.filter({ hasText: 'NextStep' })).toBeVisible();
    await expect(nodes.filter({ hasText: 'Done' })).toBeVisible();
  });
});
