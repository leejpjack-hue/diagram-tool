import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

function pngSize(buffer: Buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function openDeck(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.getByRole('button', { name: 'View deck' }).click();
  await expect(page.getByRole('heading', { name: 'Frames' })).toBeVisible();
}

async function drawFrame(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.getByRole('button', { name: 'Frame (F)' }).click();
  const box = await page.getByRole('main').boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + x1, box!.y + y1);
  await page.mouse.down();
  await page.mouse.move(box!.x + x2, box!.y + y2, { steps: 10 });
  await page.mouse.up();
}

async function titleSelectedFrame(page: Page, title: string) {
  const input = page.getByLabel('Frame title');
  await expect(input).toBeVisible();
  await input.fill(title);
}

test.describe('Deck frames as first-class containers', () => {
  test.describe.configure({ timeout: 60_000 });

  test('creates titled frames, presents them in order, and exports one frame smaller than all', async ({ page }) => {
    await openDeck(page);

    await drawFrame(page, 220, 120, 460, 280);
    await titleSelectedFrame(page, 'Intro');
    await drawFrame(page, 500, 120, 740, 280);
    await titleSelectedFrame(page, 'Review');
    await drawFrame(page, 220, 360, 1100, 720);
    await titleSelectedFrame(page, 'Secret');
    await page.getByRole('button', { name: 'Hide Secret' }).click();

    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('1. Intro');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('2. Review');
    await expect(page.getByRole('list', { name: 'Frame list' })).toContainText('3. Secret');

    await page.getByRole('button', { name: 'Present deck' }).click();
    await expect(page.getByTestId('present-frame-title')).toHaveText('Intro');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('present-frame-title')).toHaveText('Review');
    await page.getByRole('button', { name: 'Present Intro' }).click();
    await expect(page.getByTestId('present-frame-title')).toHaveText('Intro');

    await page.getByRole('button', { name: 'Export' }).click();
    const oneDownload = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'This frame (PNG)' }).click();
    const onePath = await (await oneDownload).path();
    expect(onePath).toBeTruthy();
    const onePng = readFileSync(onePath!);
    const one = pngSize(onePng);

    await page.getByRole('button', { name: 'Export' }).click();
    const allDownload = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'All frames (PNG)' }).click();
    const allPath = await (await allDownload).path();
    expect(allPath).toBeTruthy();
    const allPng = readFileSync(allPath!);
    const all = pngSize(allPng);

    expect(onePng.byteLength).toBeLessThan(allPng.byteLength);
    expect(one.width * one.height).toBeLessThan(all.width * all.height);
    expect(all.height).toBeLessThan(700);

    await page.getByRole('button', { name: 'Exit present' }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Architecture' })).toBeVisible();
  });
});
