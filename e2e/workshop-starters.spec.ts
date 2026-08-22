import { expect, test, type Page } from '@playwright/test';

const STARTERS = [
  { id: 'workshop-retro', name: 'Retro', howTo: 'Park stickies in Went well, Change, or Questions. Talk through Change last.' },
  { id: 'workshop-2x2', name: '2×2', howTo: 'Plot ideas by impact vs effort. Do the high-impact / low-effort quadrant first.' },
  { id: 'workshop-user-journey', name: 'User journey', howTo: 'One sticky per step. Mark the emotion under each step as you walk the path.' },
  { id: 'workshop-standup', name: 'Standup', howTo: "Yesterday / Today / Blocked. Move yesterday's Today into Yesterday, then fill Today." },
  { id: 'workshop-design-review', name: 'Design review', howTo: 'Context first, then options, then write the decision in the last frame.' },
] as const;

async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

async function openTemplates(page: Page) {
  await openHome(page);
  await page.getByRole('button', { name: 'Templates', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Templates', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workshop' })).toBeVisible();
}

async function expectUsableNamedBoard(page: Page, name: string) {
  await expect(page.getByText('Presentation canvas')).toBeVisible();
  await expect(page.locator('header').getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText(/Untitled/i)).toHaveCount(0);
  await expect(page.locator('[data-item-id]').first()).toBeVisible();
  expect(await page.locator('[data-item-id]').count()).toBeGreaterThan(3);
}

async function backToHome(page: Page) {
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  const homeButton = page.getByRole('button', { name: '⌂ Boards' });
  if (await homeButton.isVisible()) await homeButton.click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

test.describe('Workshop ICP starters', () => {
  test.describe.configure({ timeout: 90_000 });

  test('all five workshop cards are visible and searchable', async ({ page }) => {
    await openHome(page);
    for (const starter of STARTERS) {
      await expect(page.getByTestId(`template-card-${starter.id}`)).toBeVisible();
      await expect(page.getByText(starter.howTo)).toBeVisible();
    }

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Templates' }).click();
    for (const starter of STARTERS) {
      await expect(page.getByRole('dialog').getByTestId(`template-card-${starter.id}`)).toBeVisible();
    }
    await page.getByRole('button', { name: 'Close' }).click();

    await openTemplates(page);
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

    await expectUsableNamedBoard(page, 'Retro');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Went well');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Change');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('Questions');

    await backToHome(page);
    await expect(page.getByRole('heading', { name: 'Retro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Untitled/i })).toHaveCount(0);
  });

  test('applying each starter titles the board and opens a usable deck', async ({ page }) => {
    for (const starter of STARTERS) {
      await openHome(page);
      await page.getByTestId(`template-card-${starter.id}`).click();
      await expectUsableNamedBoard(page, starter.name);
      await backToHome(page);
      await expect(page.getByRole('heading', { name: starter.name, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Untitled/i })).toHaveCount(0);
    }
  });
});
