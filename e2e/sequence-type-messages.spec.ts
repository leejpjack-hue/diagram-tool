import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';

// DT-SEQ-02: Type messages turns plain lines into a sequence diagram.
test.describe.configure({ timeout: testTimeout(90_000) });

const LINES = [
  'User asks Agent: plan my trip',
  'Search tool replies Agent: 3 options',
  'if no flights:',
  'Agent tells User: try other dates',
  'else:',
];

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

test('Type messages builds an alt sequence, flags a bad line, and refills after reload', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Sequence Open a clean DSL canvas.' }).click();
  await waitForEditor(page);
  await expect(page.getByTestId('board-mode-status')).toHaveText('Sequence');
  await expect(page.getByTestId('toggle-type-steps')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-parts')).toHaveCount(0);
  await expect(page.getByTestId('toggle-type-messages')).toBeVisible();

  await page.getByTestId('toggle-type-messages').click();
  await expect(page.getByTestId('type-messages-handwritten-hint')).toBeVisible();
  await expect(page.getByTestId('type-messages-input')).toHaveValue('');
  await expect(page.getByTestId('type-messages-preview-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('type-messages-preview-summary')).toHaveText('0 lines, 0 warnings');
  await expect(page.getByTestId('type-messages-preview-empty')).toContainText('No messages typed yet.');

  const canvas = page.locator('.sequence-canvas');

  // Empty Build surfaces a plain-words error near Type messages and leaves the canvas unchanged.
  await page.getByTestId('build-messages').click();
  await expect(page.getByTestId('type-messages-error')).toContainText('Type one message per line first.');
  await expect(canvas.getByText('Actor', { exact: true }).first()).toBeVisible();

  // Unparseable-only Build surfaces a plain-words error near Type messages and leaves the canvas unchanged.
  await page.getByTestId('type-messages-input').fill('this is not a message');
  await expect(page.getByTestId('type-messages-error')).toHaveCount(0);
  await expect(page.getByTestId('type-messages-preview-summary')).toHaveText('1 line, 1 warning');
  await expect(page.getByTestId('type-messages-preview-warning')).toContainText("wasn't understood");
  await page.getByTestId('build-messages').click();
  await expect(page.getByTestId('type-messages-error')).toContainText('No messages found.');
  await expect(canvas.getByText('Actor', { exact: true }).first()).toBeVisible();

  const typed = `${LINES.join('\n')}\nthis is not a message`;
  await page.getByTestId('type-messages-input').fill(typed);
  await expect(page.getByTestId('type-messages-error')).toHaveCount(0);
  await expect(page.getByTestId('type-messages-preview-empty')).toHaveCount(0);
  await expect(page.getByTestId('type-messages-preview-summary')).toHaveText('6 lines, 1 warning');
  await expect(page.getByTestId('type-messages-preview-warning')).toContainText("wasn't understood");
  await expect(page.getByTestId('type-messages-preview')).toContainText('User → Agent (call) "plan my trip"');
  await expect(page.getByTestId('type-messages-preview')).toContainText('Search tool → Agent (reply) "3 options"');
  await expect(page.getByTestId('type-messages-preview')).toContainText('alt no flights');
  await expect(page.getByTestId('type-messages-preview')).toContainText('Agent → User (call) "try other dates"');
  await expect(page.getByTestId('type-messages-preview')).toContainText('else');

  // Board stays unchanged until Build board is clicked.
  await expect(canvas.getByText('Actor', { exact: true }).first()).toBeVisible();
  await expect(canvas.getByText('Search tool', { exact: true })).toHaveCount(0);

  await page.getByTestId('build-messages').click();
  await expect(page.getByTestId('toast-item').filter({ hasText: '3 participants, 3 messages' })).toBeVisible();

  await expect(canvas.getByText('User', { exact: true }).first()).toBeVisible();
  await expect(canvas.getByText('Agent', { exact: true }).first()).toBeVisible();
  await expect(canvas.getByText('Search tool', { exact: true }).first()).toBeVisible();
  await expect(canvas.getByText('Actor', { exact: true })).toHaveCount(0);
  await expect(canvas.getByText('ALT', { exact: true })).toBeVisible();
  await expect(canvas.getByText('no flights', { exact: true })).toBeVisible();
  // Message labels sit in an SVG <text> that also carries a <title> tooltip,
  // so the element's full string is longer than the label. Lifelines are
  // dashed 5 5; a dashed reply is the only 6 4 stroke.
  await expect(canvas.locator('text').filter({ hasText: 'plan my trip' })).toBeVisible();
  await expect(canvas.locator('text').filter({ hasText: 'try other dates' })).toBeVisible();
  await expect(canvas.locator('text').filter({ hasText: '3 options' })).toBeVisible();
  await expect(canvas.locator('text').filter({ hasText: 'this is not a message' })).toHaveCount(0);
  await expect(canvas.locator('line[stroke-dasharray="6 4"]')).toHaveCount(1);

  await page.waitForFunction(() => (localStorage.getItem('diagram-tool-pending-board-writes') ?? '').includes('@type-messages'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Untitled Sequence' }).click();
  await waitForEditor(page);

  await page.getByTestId('toggle-type-messages').click();
  const restored = await page.getByTestId('type-messages-input').inputValue();
  for (const line of LINES) expect(restored).toContain(line);
  expect(restored).toContain('this is not a message');
});
