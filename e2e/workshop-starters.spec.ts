import { expect, test } from '@playwright/test';

const STARTERS = [
  { name: 'Retro', howTo: 'Park stickies in Went well, Change, or Questions. Talk through Change last.' },
  { name: '2×2', howTo: 'Plot ideas by impact vs effort. Do the high-impact / low-effort quadrant first.' },
  { name: 'User journey', howTo: 'One sticky per step. Mark the emotion under each step as you walk the path.' },
  { name: 'Standup', howTo: "Yesterday / Today / Blocked. Move yesterday's Today into Yesterday, then fill Today." },
  { name: 'Design review', howTo: 'Context first, then options, then write the decision in the last frame.' },
] as const;

async function openTemplates(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workshop' })).toBeVisible();
}

test.describe('Workshop ICP starters', () => {
  test.describe.configure({ timeout: 60_000 });

  test('all five workshop cards are visible and searchable', async ({ page }) => {
    await openTemplates(page);
    for (const starter of STARTERS) {
      await expect(page.getByRole('button', { name: new RegExp(starter.name) })).toBeVisible();
      await expect(page.getByText(starter.howTo)).toBeVisible();
    }

    for (const starter of STARTERS) {
      await page.getByPlaceholder('Search templates...').fill(starter.name);
      await expect(page.getByRole('button', { name: new RegExp(starter.name) })).toBeVisible();
      await expect(page.getByText(starter.howTo)).toBeVisible();
      await expect(page.getByRole('button', { name: /AWS 3-Tier Web Application/ })).toHaveCount(0);
    }
  });

  test('creating Retro opens a titled deck with more than 3 objects, not Untitled', async ({ page }) => {
    await openTemplates(page);
    await page.getByPlaceholder('Search templates...').fill('Retro');
    await page.getByRole('button', { name: /Retro/ }).click();

    await expect(page.getByText('Presentation canvas')).toBeVisible();
    await expect(page.locator('header').getByText('Retro', { exact: true })).toBeVisible();
    await expect(page.getByText(/Untitled/i)).toHaveCount(0);
    await expect(page.locator('[data-item-id]').first()).toBeVisible();
    expect(await page.locator('[data-item-id]').count()).toBeGreaterThan(3);
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Went well');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Change');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Questions');

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    const homeButton = page.getByRole('button', { name: '⌂ Boards' });
    if (await homeButton.isVisible()) await homeButton.click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Retro' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Untitled/i })).toHaveCount(0);
  });
});
