import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { testTimeout } from './testTimeout';

const STEPS = 'Collect request\nReview request\nSend reply';
const CLOUD_HOST = /teqcon|supabase\.co|diagram-tool\.com/i;
const SHOTS = '/opt/cursor/artifacts';

test.describe('Home blank board is typed text', () => {
  test.describe.configure({ timeout: testTimeout(90_000) });

  test('a new blank workflow is typable and the canvas follows three steps', async ({ page }) => {
    const cloud: string[] = [];
    const skillRuns: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (CLOUD_HOST.test(url)) cloud.push(url);
      if (url.includes('/api/skills/type-to-flow/run')) skillRuns.push(url);
    });

    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    const blank = page.getByTestId('home-blank-flow');
    await expect(blank).toBeVisible();
    await expect(blank).toContainText('Type the steps');
    await blank.click();

    const input = page.getByTestId('type-steps-input');
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('');
    await expect(page.locator('.react-flow')).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Pin\b/i })).toHaveCount(0);
    await expect(page.getByText('Pin chrome')).toHaveCount(0);

    mkdirSync(SHOTS, { recursive: true });
    await input.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(SHOTS, 'home-blank-type-ready.png') });

    await input.fill('Collect request');
    await expect(page.locator('.react-flow__node', { hasText: 'Collect request' })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(input).toHaveValue('Collect request');
    await page.screenshot({ path: join(SHOTS, 'home-blank-type-one-step.png') });

    await input.fill(STEPS);
    await expect(page.locator('.react-flow__node', { hasText: 'Collect request' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Review request' })).toBeVisible();
    await expect(page.locator('.react-flow__node', { hasText: 'Send reply' })).toBeVisible();
    await expect(page.locator('.react-flow__node')).toHaveCount(3);
    await expect.poll(async () => nodesInView(page)).toBe(true);
    await expect(input).toHaveValue(STEPS);
    await expect(page.getByTestId('build-steps')).toBeVisible();
    const source = await editorSource(page);
    expect(source).toContain('label: "Collect request"');
    expect(source).toContain('label: "Review request"');
    expect(source).toContain('label: "Send reply"');
    await page.screenshot({ path: join(SHOTS, 'home-blank-type-three-steps.png') });

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Untitled Workflow' }) });
    await expect(card.getByTestId('human-authored-mark')).toHaveText('Written by a human');
    await expect(card.getByTestId('skill-authored-mark')).toHaveCount(0);

    await card.getByTestId('open-as-text').click();
    await expect(page.getByTestId('type-steps-input')).toHaveValue(STEPS);
    await expect(page.locator('.react-flow__node')).toHaveCount(3);

    expect(skillRuns).toEqual([]);
    expect(cloud).toEqual([]);
  });
});

async function nodesInView(page: Page): Promise<boolean> {
  const viewport = page.viewportSize();
  if (!viewport) return false;
  const boxes = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  }));
  if (boxes.length !== 3) return false;
  return boxes.every(box =>
    box.w > 40
    && box.h > 20
    && box.x > 200
    && box.y > 50
    && box.x + box.w < viewport.width - 8
    && box.y + box.h < viewport.height - 8,
  );
}

async function editorSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const monaco = (window as unknown as {
      monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } };
    }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}
