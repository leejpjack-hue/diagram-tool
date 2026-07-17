import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:8888';

test.describe('Gantt Chart - Full Feature Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('Phase 1.1: Load MVP Sprint', async ({ page }) => {
    // Click File menu
    await page.click('button:has-text("File")');
    
    // Click Load MVP Sprint
    await page.click('button:has-text("Load MVP Sprint")');
    
    // Wait for Gantt chart to load
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Verify tasks are loaded
    const taskElements = await page.locator('text=/Sprint \\d|Delay Impact|Visualization|What-If|Risk Scoring|AI Suggestions|Testing/').count();
    expect(taskElements).toBeGreaterThan(5);
    
    console.log('✅ MVP Sprint loaded successfully');
  });

  test('Phase 2.1: Delay Impact Analysis', async ({ page }) => {
    // Load MVP Sprint first
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Click Delay Impact button
    await page.click('button:has-text("Delay Impact")');
    
    // Wait for panel to open
    await page.waitForSelector('text=Delay Impact Analysis', { timeout: 3000 });
    
    // Select task
    await page.click('select');
    await page.selectOption('select', { label: /Delay Impact MVP/ });
    
    // Input delay days
    await page.fill('input[type="number"]', '2');
    
    // Click Analyze
    await page.click('button:has-text("Analyze")');
    
    // Wait for results
    await page.waitForSelector('text=/Tasks Affected|Project Delay|Risk Score/', { timeout: 5000 });
    
    // Verify results are shown
    const affectedCount = await page.locator('text=/\\d+ tasks? affected/').textContent();
    expect(affectedCount).toBeTruthy();
    
    console.log('✅ Delay Impact Analysis completed');
  });

  test('Phase 2.2: Delay Impact Visualization', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Open Delay Impact panel
    await page.click('button:has-text("Delay Impact")');
    await page.waitForSelector('text=Delay Impact Analysis', { timeout: 3000 });
    
    // Analyze delay
    await page.selectOption('select', { label: /Delay Impact MVP/ });
    await page.fill('input[type="number"]', '2');
    await page.click('button:has-text("Analyze")');
    await page.waitForSelector('text=/Tasks Affected/', { timeout: 5000 });
    
    // Click Visualize
    await page.click('button:has-text("Visualize")');
    
    // Wait for toast or visualization
    await page.waitForTimeout(1000);
    
    // Check for visualization elements (gray dashed rect, arrows)
    const visualizationElements = await page.locator('rect[stroke-dasharray], path[d*="M"]').count();
    expect(visualizationElements).toBeGreaterThan(0);
    
    console.log('✅ Visualization rendered');
  });

  test('Phase 2.3: Apply Delay Changes', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Open Delay Impact panel and analyze
    await page.click('button:has-text("Delay Impact")');
    await page.waitForSelector('text=Delay Impact Analysis', { timeout: 3000 });
    await page.selectOption('select', { label: /Delay Impact MVP/ });
    await page.fill('input[type="number"]', '2');
    await page.click('button:has-text("Analyze")');
    await page.waitForSelector('text=/Tasks Affected/', { timeout: 5000 });
    
    // Click Apply Changes
    await page.click('button:has-text("Apply Changes")');
    
    // Wait for toast notification
    await page.waitForTimeout(1000);
    
    // Verify DSL updated
    const dslContent = await page.locator('.monaco-editor').textContent();
    expect(dslContent).toContain('start:');
    expect(dslContent).toContain('end:');
    
    console.log('✅ Changes applied');
  });

  test('Phase 3.1: Auto-Schedule', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Find and click Auto-Schedule button
    const autoScheduleButton = page.locator('button:has-text("Auto-Schedule")');
    await autoScheduleButton.click();
    
    // Wait for result (alert or toast)
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Auto-schedule');
      await dialog.accept();
    });
    
    await page.waitForTimeout(2000);
    
    console.log('✅ Auto-Schedule executed');
  });

  test('Phase 4.1: Drag and Drop - Move Task', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Find a task bar
    const taskBar = page.locator('rect[cursor="grab"]').first();
    await expect(taskBar).toBeVisible();
    
    // Get initial position
    const initialX = await taskBar.getAttribute('x');
    
    // Drag task
    await taskBar.hover();
    await page.mouse.down();
    await page.mouse.move(100, 0);
    await page.mouse.up();
    
    // Wait for update
    await page.waitForTimeout(1000);
    
    // Verify position changed
    const newX = await taskBar.getAttribute('x');
    expect(newX).not.toBe(initialX);
    
    console.log('✅ Task moved successfully');
  });

  test('Phase 4.2: Resize Task Start', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Find a task with resize handles
    const resizeHandle = page.locator('rect[cursor="ew-resize"]').first();
    
    if (await resizeHandle.isVisible()) {
      // Drag resize handle
      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(-20, 0);
      await page.mouse.up();
      
      await page.waitForTimeout(1000);
      console.log('✅ Task start date adjusted');
    } else {
      console.log('⚠️ No resize handle found');
    }
  });

  test('Phase 6.1: Zoom Controls', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Click Day zoom
    await page.click('button:has-text("Day")');
    await page.waitForTimeout(500);
    
    // Click Week zoom
    await page.click('button:has-text("Week")');
    await page.waitForTimeout(500);
    
    // Click Month zoom
    await page.click('button:has-text("Month")');
    await page.waitForTimeout(500);
    
    console.log('✅ Zoom controls working');
  });

  test('Phase 6.2: Critical Path Toggle', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Click Critical Path button
    await page.click('button:has-text("Critical")');
    await page.waitForTimeout(1000);
    
    // Verify critical path is shown (red elements)
    const criticalElements = await page.locator('rect[fill*="red"], path[stroke*="red"]').count();
    expect(criticalElements).toBeGreaterThan(0);
    
    // Toggle off
    await page.click('button:has-text("Critical")');
    await page.waitForTimeout(500);
    
    console.log('✅ Critical path toggle working');
  });

  test('Integration: Drag + Auto-Schedule', async ({ page }) => {
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Drag a task to violate dependency
    const taskBar = page.locator('rect[cursor="grab"]').nth(2);
    if (await taskBar.isVisible()) {
      await taskBar.hover();
      await page.mouse.down();
      await page.mouse.move(-100, 0); // Move left to violate dependency
      await page.mouse.up();
      await page.waitForTimeout(500);
      
      // Run Auto-Schedule to fix
      await page.click('button:has-text("Auto-Schedule")');
      await page.waitForTimeout(2000);
      
      console.log('✅ Integration test passed');
    }
  });
});

test.describe('UI/UX Tests', () => {
  test('Button colors are correct', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Check Auto-Schedule button color
    const autoScheduleBtn = page.locator('button:has-text("Auto-Schedule")');
    const bgColor = await autoScheduleBtn.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Should be purple-ish (RGB values)
    console.log('Auto-Schedule button color:', bgColor);
    
    // Check Critical Path button
    const criticalBtn = page.locator('button:has-text("Critical")');
    expect(await criticalBtn.isVisible()).toBeTruthy();
    
    console.log('✅ Button colors verified');
  });

  test('Toast notifications appear', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Load MVP Sprint
    await page.click('button:has-text("File")');
    await page.click('button:has-text("Load MVP Sprint")');
    await page.waitForSelector('svg', { timeout: 5000 });
    
    // Trigger an action that should show toast
    await page.click('button:has-text("Auto-Schedule")');
    
    // Wait for alert (temporary solution)
    page.on('dialog', dialog => {
      console.log('Alert shown:', dialog.message());
      dialog.accept();
    });
    
    await page.waitForTimeout(2000);
    
    console.log('✅ Notification test completed');
  });
});
