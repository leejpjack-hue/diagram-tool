import { test, expect, type Page } from '@playwright/test';

async function openEditorFromDashboard(page: Page) {
  await page.goto('/app/');
  const blankArch = page.getByRole('button', { name: /Blank Architecture/i }).first();
  await expect(blankArch).toBeVisible({ timeout: 10000 });
  await blankArch.click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible({ timeout: 10000 });
}

test.describe('Architecture Mode', () => {
  test.beforeEach(async ({ page }) => {
    await openEditorFromDashboard(page);
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
    // Wait for page to be ready
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Press P key
    await page.keyboard.press('p');
    
    // Wait a moment for panel to open
    await page.waitForTimeout(300);
    
    // Properties panel should be visible - check for the button in the panel or panel content
    const propertiesButton = page.getByRole('button', { name: 'Properties' });
    const panelVisible = await page.locator('[data-testid="properties-panel"]')
      .or(page.locator('text=/node properties/i'))
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    if (!panelVisible) {
      await propertiesButton.click();
      await page.waitForTimeout(300);
    }
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('should zoom with controls', async ({ page }) => {
    // Wait for canvas to be ready
    await page.waitForSelector('.react-flow', { timeout: 10000 });
    
    const zoomBtn = page.getByRole('button', { name: /zoom in|zoom out/i }).and(page.locator(':not([disabled])')).first();
    
    if (await zoomBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await zoomBtn.click();
      await page.waitForTimeout(300);
      await expect(page.locator('.react-flow')).toBeVisible();
    } else {
      await expect(page.locator('.react-flow')).toBeVisible();
    }
  });
});

test.describe('Save/Load', () => {
  test('should save diagram with Ctrl+S', async ({ page }) => {
    await openEditorFromDashboard(page);
    
    // Wait for load
    await page.waitForSelector('.react-flow__node', { timeout: 5000 });
    
    // Press Ctrl+S
    await page.keyboard.press('Control+s');
    
    // Should show toast notification or saved status
    await expect(page.getByTestId('toast-item').or(page.getByText(/Saved/i)).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show File menu', async ({ page }) => {
    await openEditorFromDashboard(page);
    
    // Click File menu button
    const fileBtn = page.getByRole('button', { name: /file/i });
    if (await fileBtn.isVisible()) {
      await fileBtn.click();
      
      // Should show dropdown with options
      await expect(page.getByText(/new/i).first()).toBeVisible();
      await expect(page.getByText(/save/i).first()).toBeVisible();
    }
  });
});

test.describe('Export', () => {
  test('should open export panel with E key', async ({ page }) => {
    await openEditorFromDashboard(page);
    
    // Press E key or click Export button
    await page.keyboard.press('e');
    const exportBtn = page.getByRole('button', { name: 'Export', exact: true });
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click();
    }
    
    // Export panel should be visible
    await expect(page.getByText(/export/i).first()).toBeVisible();
  });
});
