import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';

// DT-ARCH-01: Type parts turns plain lines into an architecture board.
test.describe.configure({ timeout: testTimeout(90_000) });

const LINES = [
  'User -> Chat app: asks',
  'Chat app -> Agent: question',
  'Agent -> Model (AI): prompt',
  'Agent -> Vector DB: search',
  'Agent -> Search tool: web search',
  'inside Cloud: Chat app, Agent, Vector DB',
];

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test('Type parts builds the example board, flags a garbage line, and refills after reload', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('toggle-type-steps')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-parts')).toBeVisible();

  await page.getByTestId('toggle-type-parts').click();
  await expect(page.getByTestId('type-parts-handwritten-hint')).toBeVisible();
  await expect(page.getByTestId('type-parts-input')).toHaveValue('');
  await expect(page.getByTestId('type-parts-preview-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('type-parts-preview-summary')).toHaveText('0 lines, 0 warnings');
  await expect(page.getByTestId('type-parts-preview-empty')).toContainText('No parts typed yet.');

  // Empty Build surfaces a plain-words error near Type parts and leaves the canvas unchanged.
  await page.getByTestId('build-parts').click();
  await expect(page.getByTestId('type-parts-error')).toContainText('Type one part per line first.');
  await expect(page.locator('.react-flow__node', { hasText: 'FirstService' })).toBeVisible();

  // Unparseable-only Build surfaces a plain-words error near Type parts and leaves the canvas unchanged.
  await page.getByTestId('type-parts-input').fill('this is not a part');
  await expect(page.getByTestId('type-parts-error')).toHaveCount(0);
  await expect(page.getByTestId('type-parts-preview-summary')).toHaveText('1 line, 1 warning');
  await expect(page.getByTestId('type-parts-preview-warning')).toContainText("wasn't understood");
  await page.getByTestId('build-parts').click();
  await expect(page.getByTestId('type-parts-error')).toContainText('No parts found.');
  await expect(page.locator('.react-flow__node', { hasText: 'FirstService' })).toBeVisible();

  const typed = `${LINES.join('\n')}\nthis is not a part`;
  await page.getByTestId('type-parts-input').fill(typed);
  await expect(page.getByTestId('type-parts-error')).toHaveCount(0);
  await expect(page.getByTestId('type-parts-preview-empty')).toHaveCount(0);
  await expect(page.getByTestId('type-parts-preview-summary')).toHaveText('7 lines, 1 warning');
  await expect(page.getByTestId('type-parts-preview-warning')).toContainText("wasn't understood");
  await expect(page.getByTestId('type-parts-preview')).toContainText('User (user) → Chat app · "asks"');
  await expect(page.getByTestId('type-parts-preview')).toContainText('Chat app → Agent (AI) · "question"');
  await expect(page.getByTestId('type-parts-preview')).toContainText('Agent (AI) → Model (AI) · "prompt"');
  await expect(page.getByTestId('type-parts-preview')).toContainText('Agent (AI) → Vector DB (database) · "search"');
  await expect(page.getByTestId('type-parts-preview')).toContainText('Agent (AI) → Search tool (tool) · "web search"');
  await expect(page.getByTestId('type-parts-preview')).toContainText('inside Cloud · Chat app, Agent (AI), Vector DB (database)');

  // Board stays unchanged until Build board is clicked.
  await expect(page.locator('.react-flow__node', { hasText: 'FirstService' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Chat app' })).toHaveCount(0);

  await page.getByTestId('build-parts').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: '6 parts, 5 connections' })).toBeVisible();

  await expect(page.locator('.react-flow__node', { hasText: 'User' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Chat app' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Agent' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Model' })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'Search tool' })).toBeVisible();
  await expect(page.locator('.react-flow__node-database', { hasText: 'Vector DB' })).toBeVisible();
  await expect(page.locator('.react-flow__node-groupcontainer', { hasText: 'Cloud' })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('asks', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('question', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('prompt', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('search', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow').getByText('web search', { exact: true })).toBeVisible();
  await expect(page.locator('.react-flow__node', { hasText: 'this is not a part' })).toHaveCount(0);

  // The localStorage pending-write mirror is cleared as soon as IndexedDB
  // accepts the board, so a wait on that key misses a save that already landed.
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('diagram-tool-workspace');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const boards = await new Promise<Array<{ title?: string; dslText?: string }>>((resolve, reject) => {
      const request = db.transaction('boards', 'readonly').objectStore('boards').getAll();
      request.onsuccess = () => resolve(request.result as Array<{ title?: string; dslText?: string }>);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return boards.find(board => board.title === 'Untitled Architecture')?.dslText ?? '';
  }), { timeout: 8000 }).toContain('@type-parts');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Untitled Architecture' }).click();
  await waitForEditor(page);

  await page.getByTestId('toggle-type-parts').click();
  const restored = await page.getByTestId('type-parts-input').inputValue();
  for (const line of LINES) expect(restored).toContain(line);
  expect(restored).toContain('this is not a part');
});
