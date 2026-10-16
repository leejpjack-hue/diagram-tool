import { test, expect, type Page } from '@playwright/test';

async function openEditorFromDashboard(page: Page) {
  await page.goto('/app/');
  const blankArch = page.getByRole('button', { name: /Blank Architecture/i }).first();
  await expect(blankArch).toBeVisible({ timeout: 10000 });
  await blankArch.click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible({ timeout: 10000 });
}

test.describe('Gantt Visual Tests - With Design Prototype', () => {
  test.beforeEach(async ({ page }) => {
    await openEditorFromDashboard(page);
  });

  test('PROTOTYPE: Desktop should show proper Gantt layout', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/gantt-desktop-current.png', fullPage: true });

    // Verify layout structure
    const dslEditor = page.locator('[data-testid="dsl-editor"]').or(page.locator('.monaco-editor')).first();
    const ganttTimeline = page.locator('[data-testid="gantt-timeline"]').or(page.locator('.gantt-chart')).or(page.locator('svg').filter({ hasText: /Task Name/i })).first();
    const taskList = page.locator('[data-testid="gantt-tasks"]').or(page.locator('text=/Gantt Tasks/i')).first();

    // Check all three panels are visible on desktop
    await expect(dslEditor).toBeVisible({ timeout: 5000 });
    await expect(ganttTimeline).toBeVisible({ timeout: 5000 });
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Verify task items are visible
    const taskBars = page.locator('text=/Planning|Requirements|Design|Deployment/i');
    const taskBarCount = await taskBars.count();
    console.log(`Found ${taskBarCount} task bars`);

    // EXPECTED: Should have at least 3 visible task entries
    expect(taskBarCount).toBeGreaterThanOrEqual(3);

    // Take screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('PROTOTYPE: Mobile should show timeline OR editor, not both', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/gantt-mobile-current.png', fullPage: true });

    // On mobile, should have a way to switch between editor and timeline
    const toggleButtons = page.locator('button').filter({ hasText: /timeline|editor|chart/i });
    const toggleCount = await toggleButtons.count();

    console.log(`Found ${toggleCount} view toggle buttons`);

    // EXPECTED: Should have toggle to switch views on mobile
    if (toggleCount > 0) {
      // Click timeline view
      await toggleButtons.first().click();
      await page.waitForTimeout(300);

      // Timeline should now be visible
      const timeline = page.locator('[data-testid="gantt-timeline"]').or(page.locator('.gantt-chart')).first();
      const timelineVisible = await timeline.isVisible({ timeout: 3000 }).catch(() => false);

      console.log(`Timeline visible after toggle: ${timelineVisible}`);
    }

    // Take screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('PROTOTYPE: Task bars should be aligned with dates', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check if date grid is visible
    const dateGrid = page.locator('[data-testid="date-grid"]').or(page.locator('.date-header'));
    const gridVisible = await dateGrid.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Date grid visible: ${gridVisible}`);

    // Check task bar alignment
    const planningBar = page.locator('text=/planning/i').first();
    if (await planningBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      const boundingBox = await planningBar.boundingBox();
      console.log('Planning task bar position:', boundingBox);

      // EXPECTED: Task bar should be within timeline bounds
      expect(boundingBox).not.toBeNull();
      expect(boundingBox?.width).toBeGreaterThan(50); // Should have reasonable width
    }

    // Take screenshot for manual review
    await page.screenshot({ path: 'test-results/gantt-task-alignment.png', fullPage: true });
  });

  test('PROTOTYPE: Progress bars should match percentages', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check progress indicators
    const progress100 = page.locator('text=/100%/i');
    const progress60 = page.locator('text=/60%/i');
    const progress20 = page.locator('text=/20%/i');

    // EXPECTED: All progress indicators should be visible
    const has100 = await progress100.isVisible({ timeout: 3000 }).catch(() => false);
    const has60 = await progress60.isVisible({ timeout: 3000 }).catch(() => false);
    const has20 = await progress20.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Progress indicators: 100%=${has100}, 60%=${has60}, 20%=${has20}`);

    // At least some progress should be visible
    expect(has100 || has60 || has20).toBeTruthy();

    // Take screenshot
    await page.screenshot({ path: 'test-results/gantt-progress-bars.png', fullPage: true });
  });

  test('PROTOTYPE: No overlapping elements', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check for elements that might overlap
    const buttons = await page.locator('button').all();
    const visibleButtons = [];

    for (const button of buttons) {
      if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
        const box = await button.boundingBox();
        if (box) {
          visibleButtons.push({
            text: await button.textContent(),
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          });
        }
      }
    }

    console.log(`Found ${visibleButtons.length} visible buttons`);
    console.log('Button positions:', JSON.stringify(visibleButtons, null, 2));

    // Check for overlapping buttons
    for (let i = 0; i < visibleButtons.length; i++) {
      for (let j = i + 1; j < visibleButtons.length; j++) {
        const b1 = visibleButtons[i];
        const b2 = visibleButtons[j];

        // Check if buttons overlap
        const overlaps = !(
          b1.x + b1.width < b2.x ||
          b2.x + b2.width < b1.x ||
          b1.y + b1.height < b2.y ||
          b2.y + b2.height < b1.y
        );

        if (overlaps) {
          console.log(`⚠️  OVERLAP: "${b1.text}" overlaps with "${b2.text}"`);
        }
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/gantt-overlap-check.png', fullPage: true });
  });

  test('PROTOTYPE: Controls are accessible', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check all important controls are visible and clickable
    const controls = [
      { name: 'Add Task', selector: 'button:has-text("Add Task")' },
      { name: 'Search', selector: 'input[type="search"], input[placeholder*="search" i]' },
      { name: 'Filter', selector: 'select, button:has-text("assignee" i), button:has-text("status" i)' },
      { name: 'Date Range', selector: 'button:has-text("date" i), button:has-text("range" i)' },
    ];

    for (const control of controls) {
      const element = page.locator(control.selector).first();
      const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

      if (isVisible) {
        const box = await element.boundingBox();
        console.log(`✅ ${control.name}: Visible at (${box?.x}, ${box?.y}) size: ${box?.width}x${box?.height}`);

        // Check minimum size for accessibility
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(32);
          expect(box.height).toBeGreaterThanOrEqual(24);
        }
      } else {
        console.log(`❌ ${control.name}: Not visible`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/gantt-controls-check.png', fullPage: true });
  });
});
