import { test, expect } from '@playwright/test';

test.describe('Visual/UI Tests - What Humans Actually See', () => {
  test('should render Architecture diagram correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for diagram to fully render
    await page.waitForSelector('.react-flow__node', { timeout: 10000 });
    await page.waitForTimeout(1000); // Wait for animations
    
    // Take a screenshot of the full page
    await expect(page).toHaveScreenshot('architecture-full-page.png', {
      fullPage: true,
      maxDiffPixels: 100 // Allow small differences
    });
    
    // Take screenshot of just the diagram
    const diagram = page.locator('.react-flow');
    await expect(diagram).toHaveScreenshot('architecture-diagram.png', {
      maxDiffPixels: 50
    });
  });

  test('should render Flow diagram correctly', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Flow mode
    await page.getByRole('button', { name: /flow/i }).click();
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Visual comparison
    await expect(page).toHaveScreenshot('flow-full-page.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should render Gantt chart correctly', async ({ page }) => {
    await page.goto('/');
    
    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000); // Gantt takes longer to render
    
    // Visual comparison
    await expect(page).toHaveScreenshot('gantt-full-page.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should display node details on hover', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Hover over a node
    const node = page.locator('.react-flow__node').first();
    await node.hover();
    await page.waitForTimeout(500);
    
    // Take screenshot showing hover state
    await expect(page).toHaveScreenshot('node-hover-state.png', {
      clip: { x: 0, y: 0, width: 1280, height: 720 }
    });
  });

  test('should show toast notification when saving', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Trigger save
    await page.keyboard.press('Control+s');
    
    // Wait for toast to appear
    await page.waitForTimeout(500);
    
    // Capture toast notification
    await expect(page).toHaveScreenshot('save-toast-notification.png', {
      clip: { x: 0, y: 0, width: 1280, height: 200 } // Top portion only
    });
  });

  test('should open and display properties panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Click Properties button
    await page.getByRole('button', { name: 'Properties' }).click();
    await page.waitForTimeout(500);
    
    // Take screenshot of properties panel
    await expect(page).toHaveScreenshot('properties-panel-open.png', {
      fullPage: true
    });
  });

  test('should open and display export panel', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Press E to open export panel
    await page.keyboard.press('e');
    await page.waitForTimeout(500);
    
    // Take screenshot
    await expect(page).toHaveScreenshot('export-panel-open.png', {
      fullPage: true
    });
  });

  test('should display File menu dropdown', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Click File menu
    await page.getByRole('button', { name: /file/i }).click();
    await page.waitForTimeout(300);
    
    // Take screenshot of dropdown
    await expect(page).toHaveScreenshot('file-menu-dropdown.png');
  });

  test('should zoom and show visual feedback', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow', { timeout: 5000 });
    
    // Take before screenshot
    await expect(page).toHaveScreenshot('zoom-before.png');
    
    // Click zoom in
    const zoomInBtn = page.getByRole('button', { name: /zoom in/i });
    if (await zoomInBtn.isVisible()) {
      await zoomInBtn.click();
      await page.waitForTimeout(500);
      
      // Take after screenshot - should show zoomed diagram
      await expect(page).toHaveScreenshot('zoom-after.png');
    }
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Take mobile screenshot
    await expect(page).toHaveScreenshot('mobile-view.png', {
      fullPage: true
    });
  });

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Take tablet screenshot
    await expect(page).toHaveScreenshot('tablet-view.png', {
      fullPage: true
    });
  });
});

test.describe('Accessibility Tests', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Run accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
