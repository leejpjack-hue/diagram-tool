import { testTimeout } from './testTimeout';
import { expect, test } from '@playwright/test';

// DT-AI-24: Data: steps become data shapes. No role chip. Copy as steps
// round-trips the Data: prefix.
test.describe.configure({ timeout: testTimeout(90_000) });

const STEPS = [
  'Ask the customer',
  'Data: tickets',
  'Model: draft a reply',
  'Send the reply',
].join('\n');

test('Data: tickets builds a data node with no role chip and copies back as Data: tickets', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await expect(page.getByTestId('type-steps-box')).toContainText('Data:');

  await page.getByTestId('type-steps-input').fill(STEPS);
  await page.getByTestId('build-steps').click();

  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 4 steps' });
  await expect(toast).toContainText('Built 4 steps onto the board · 1 Model · 1 data');

  const dataNode = page.locator('.react-flow__node-data').filter({ hasText: 'tickets' });
  await expect(dataNode).toBeVisible();
  await expect(dataNode.getByText('tickets', { exact: true })).toBeVisible();
  await expect(dataNode.locator('[data-role-chip]')).toHaveCount(0);

  await page.evaluate(() => {
    let last = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => { last = text; },
        readText: async () => last,
      },
    });
  });

  await page.getByTestId('copy-as-steps').click();
  await expect(page.getByText('Copied steps')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Data: tickets');
  expect(copied).not.toContain('Data: Data:');
});
