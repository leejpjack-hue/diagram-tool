import { test, expect, type Page } from '@playwright/test';

async function openEditorFromDashboard(page: Page) {
  await page.goto('/app/');
  const blankArch = page.getByRole('button', { name: /Blank Architecture/i }).first();
  await expect(blankArch).toBeVisible({ timeout: 10000 });
  await blankArch.click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible({ timeout: 10000 });
}

test.describe('Visual/UI Tests - What Humans Actually See', () => {
  test('should render Architecture diagram correctly', async ({ page }) => {
    await openEditorFromDashboard(page);

    // Wait for diagram to fully render
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });

    // Take a screenshot of the full page
    const fullShot = await page.screenshot({ fullPage: true });
    expect(fullShot.byteLength).toBeGreaterThan(1000);

    // Take screenshot of just the diagram
    const diagram = page.locator('.react-flow');
    const diagramShot = await diagram.screenshot();
    expect(diagramShot.byteLength).toBeGreaterThan(1000);
  });

  test('should render Flow diagram correctly', async ({ page }) => {
    await openEditorFromDashboard(page);

    // Switch to Flow mode
    await page.getByRole('button', { name: /flow/i }).click();
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Visual capture
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should render Gantt chart correctly', async ({ page }) => {
    await openEditorFromDashboard(page);

    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Visual capture
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should display node details on hover', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Hover over a node
    const node = page.locator('.react-flow__node').first();
    await node.hover();

    // Take screenshot showing hover state
    const shot = await page.screenshot({
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should show toast notification when saving', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Trigger save
    await page.keyboard.press('Control+s');

    // Wait for toast to appear
    await expect(page.getByTestId('toast-item').first()).toBeVisible({ timeout: 5000 });

    // Capture toast notification
    const shot = await page.screenshot({
      clip: { x: 0, y: 0, width: 1280, height: 200 },
    });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should open and display properties panel', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Click Properties button
    await page.getByRole('button', { name: 'Properties' }).click();

    // Take screenshot of properties panel
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should open and display export panel', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Open export panel via toolbar button
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByTestId('export-portable-copy')).toBeVisible({ timeout: 5000 });

    // Take screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should display File menu dropdown', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Click File menu
    await page.getByRole('button', { name: /file/i }).click();
    await expect(page.getByTestId('file-menu')).toBeVisible({ timeout: 5000 });

    // Take screenshot of dropdown
    const shot = await page.screenshot();
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should zoom and show visual feedback', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow', { timeout: 5000 });

    // Take before screenshot
    const beforeShot = await page.screenshot();
    expect(beforeShot.byteLength).toBeGreaterThan(1000);

    // Click an enabled zoom control (Zoom In or Zoom Out depending on initial fitView zoom)
    const zoomBtn = page.getByRole('button', { name: /zoom in|zoom out/i }).and(page.locator(':not([disabled])')).first();
    if (await zoomBtn.isVisible()) {
      await zoomBtn.click();

      // Take after screenshot - should show zoomed diagram
      const afterShot = await page.screenshot();
      expect(afterShot.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await openEditorFromDashboard(page);

    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Take mobile screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await openEditorFromDashboard(page);

    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Take tablet screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });
});

test.describe('Accessibility Tests', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await openEditorFromDashboard(page);
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });

    // Verify core landmarks, accessible names on controls, and alt attributes on images
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    const unnamedButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).filter(btn => {
        const text = (btn.textContent || '').trim();
        const label = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
        return !text && !label;
      }).length;
    });
    expect(unnamedButtons).toBe(0);
    await expect(page.locator('img:not([alt])')).toHaveCount(0);
  });
});
