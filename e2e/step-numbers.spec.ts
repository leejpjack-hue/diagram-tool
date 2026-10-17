import { expect, test, type Page } from '@playwright/test';

const STEPS = [
  'Ask the question',
  'Draft an answer',
  'Review the draft',
  'Send the reply',
].join('\n');

async function openBlankWorkflow(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();
  await expect(page.getByTestId('icon-style-picker')).toBeVisible();
}

test.describe('Flow step numbers', () => {
  test.describe.configure({ timeout: 120_000 });

  test('toggles badges 1..4 in walk order, matches step 3, and keeps the toggle after reload', async ({ page }) => {
    await openBlankWorkflow(page);
    await page.getByTestId('toggle-type-steps').click();
    await page.getByTestId('type-steps-input').fill(STEPS);
    await page.getByTestId('build-steps').click();
    await expect(page.getByTestId('toast-item').filter({ hasText: /Built 4 steps/ })).toBeVisible();
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    const toggle = page.getByTestId('toggle-step-numbers');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('step-number')).toHaveCount(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    const labels = ['Ask the question', 'Draft an answer', 'Review the draft', 'Send the reply'];
    const boxes = [];
    for (let step = 1; step <= 4; step += 1) {
      const badge = page.getByRole('img', { name: `Step ${step}` });
      await expect(badge).toBeVisible();
      await expect(badge).toHaveAttribute('data-step-number', String(step));
      const node = page.locator('.react-flow__node').filter({ has: badge });
      await expect(node).toContainText(labels[step - 1]);
      const box = await badge.boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
    }
    expect(boxes[0].y).toBeLessThan(boxes[1].y);
    expect(boxes[1].y).toBeLessThan(boxes[2].y);
    expect(boxes[2].y).toBeLessThan(boxes[3].y);

    await page.getByTestId('walk-through').click();
    await page.getByTestId('walk-through-next').click();
    await page.getByTestId('walk-through-next').click();
    const caption = page.getByTestId('walk-through-caption');
    await expect(caption).toContainText('Step 3 of 4');
    await expect(caption).toContainText('Review the draft');
    const step3 = page.getByRole('img', { name: 'Step 3' });
    await expect(step3).toHaveAttribute('aria-label', 'Step 3');
    await expect(page.locator('.react-flow__node').filter({ has: step3 })).toContainText('Review the draft');
    await page.getByTestId('walk-through-exit').click();

    await expect.poll(async () => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('diagram-tool-workspace');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const boards = await new Promise<Array<{ title?: string; showStepNumbers?: boolean; iconStyle?: string }>>((resolve, reject) => {
        const request = db.transaction('boards', 'readonly').objectStore('boards').getAll();
        request.onsuccess = () => resolve(request.result as Array<{ title?: string; showStepNumbers?: boolean; iconStyle?: string }>);
        request.onerror = () => reject(request.error);
      });
      db.close();
      const board = boards.find(item => item.title === 'Untitled Workflow');
      return board?.showStepNumbers === true && board.iconStyle === undefined;
    }), { timeout: 8000 }).toBe(true);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('heading', { name: 'Untitled Workflow' }).first().click();
    await expect(page.getByTestId('toggle-step-numbers')).toHaveAttribute('aria-pressed', 'true');
    for (let step = 1; step <= 4; step += 1) {
      await expect(page.getByRole('img', { name: `Step ${step}` })).toBeVisible();
    }
  });
});
