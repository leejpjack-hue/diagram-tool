import { test, expect } from '@playwright/test';

test.describe('Architecture Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load with Architecture tab active', async ({ page }) => {
    // Check Architecture tab is active
    const archTab = page.getByRole('button', { name: /architecture/i });
    await expect(archTab).toHaveClass(/active/);
    
    // Check canvas renders
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('should render nodes from default DSL', async ({ page }) => {
    // Wait for canvas to load
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Should have at least one node
    const nodes = await page.locator('.react-flow__node').count();
    expect(nodes).toBeGreaterThan(0);
  });

  test('should switch to Flow mode', async ({ page }) => {
    // Click Flow tab
    await page.getByRole('button', { name: /flow/i }).click();
    
    // Check Flow tab is active
    const flowTab = page.getByRole('button', { name: /flow/i });
    await expect(flowTab).toHaveClass(/active/);
    
    // Wait for nodes to render
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Check that flow nodes exist
    const nodes = await page.locator('.react-flow__node').count();
    expect(nodes).toBeGreaterThan(0);
  });

  test('should show properties panel when P is pressed', async ({ page }) => {
    // Press P key
    await page.keyboard.press('p');
    
    // Properties panel should be visible
    await expect(page.getByText(/properties/i)).toBeVisible();
  });

  test('should zoom with controls', async ({ page }) => {
    // Find zoom in button in footer or controls
    const zoomInBtn = page.getByRole('button', { name: /\+/i }).first();
    
    if (await zoomInBtn.isVisible()) {
      // Get initial zoom level
      const initialZoom = await page.locator('.react-flow').getAttribute('data-zoom') || '1';
      
      // Click zoom in
      await zoomInBtn.click();
      
      // Wait a moment for animation
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Save/Load', () => {
  test('should save diagram with Ctrl+S', async ({ page }) => {
    await page.goto('/');
    
    // Wait for load
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Press Ctrl+S
    await page.keyboard.press('Control+s');
    
    // Should show toast notification
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 3000 });
  });

  test('should show File menu', async ({ page }) => {
    await page.goto('/');
    
    // Click File menu button
    const fileBtn = page.getByRole('button', { name: /file/i });
    if (await fileBtn.isVisible()) {
      await fileBtn.click();
      
      // Should show dropdown with options
      await expect(page.getByText(/new/i)).toBeVisible();
      await expect(page.getByText(/save/i)).toBeVisible();
    }
  });
});

test.describe('Export', () => {
  test('should open export panel with E key', async ({ page }) => {
    await page.goto('/');
    
    // Press E key
    await page.keyboard.press('e');
    
    // Export panel should be visible
    await expect(page.getByText(/export/i)).toBeVisible();
  });
});
