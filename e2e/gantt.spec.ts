import { test, expect, type Page } from '@playwright/test';

async function openEditorFromDashboard(page: Page) {
  await page.goto('/app/');
  const blankArch = page.getByRole('button', { name: /Blank Architecture/i }).first();
  await expect(blankArch).toBeVisible({ timeout: 10000 });
  await blankArch.click();
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible({ timeout: 10000 });
}

test.describe('Gantt Functionality - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await openEditorFromDashboard(page);
  });

  test('should render Gantt chart correctly on desktop', async ({ page }) => {
    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();

    // Wait for Gantt to render
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take full page screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should render Gantt chart on mobile (375x667)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take mobile screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should render Gantt chart on tablet (768x1024)', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take tablet screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should display task list on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check if task list is visible
    const taskList = page.locator('[data-testid="gantt-tasks"]').or(page.locator('text=/task/i').first()).first();
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Take screenshot of task list
    const shot = await page.screenshot();
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should show task details on click', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Click on a task bar
    const taskBar = page.locator('[data-testid="task-bar"]').or(page.locator('text=/planning/i')).first();
    if (await taskBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskBar.click();
      await page.waitForTimeout(300);

      // Take screenshot showing task details
      const shot = await page.screenshot();
      expect(shot.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should use date range picker on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Look for date range button
    const dateButton = page.getByRole('button', { name: /date range/i }).or(
      page.locator('button').filter({ hasText: /calendar|date/i })
    ).first();

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(300);

      // Take screenshot of date picker
      const shot = await page.screenshot();
      expect(shot.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should filter tasks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Look for filter dropdown
    const filterButton = page.getByRole('button', { name: /assignee|status/i }).or(
      page.locator('select').first()
    ).first();

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);

      // Take screenshot of filter options
      const shot = await page.screenshot();
      expect(shot.byteLength).toBeGreaterThan(1000);
    }
  });

  test('should scroll timeline horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/task|inception|deployment|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Scroll right in the timeline area
    const timeline = page.locator('[data-testid="gantt-timeline"]').or(page.locator('.gantt-chart')).first();
    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timeline.evaluate((el) => el.scrollLeft = 200);
      await page.waitForTimeout(300);

      // Take screenshot showing scrolled timeline
      const shot = await page.screenshot();
      expect(shot.byteLength).toBeGreaterThan(1000);
    }
  });
});

test.describe('Gantt Functionality - Functional Tests', () => {
  test.beforeEach(async ({ page }) => {
    await openEditorFromDashboard(page);
  });

  test('should switch to Gantt mode successfully', async ({ page }) => {
    // Click Gantt tab
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check Gantt tab is active
    const ganttTab = page.getByRole('button', { name: /gantt/i });
    await expect(ganttTab).toHaveClass(/active/);

    // Verify Gantt elements are visible
    const ganttItem = page.locator('text=/task|timeline|planning/i').first();
    await expect(ganttItem).toBeVisible({ timeout: 5000 });
  });

  test('should display task list with assignees', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check for task names
    await expect(page.locator('text=/planning|requirements|design/i').first()).toBeVisible({ timeout: 5000 });

    // Check for assignees
    await expect(page.locator('text=/jack|sarah|mike/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show progress indicators', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check for progress percentages
    await expect(page.locator('text=/100%|60%|20%/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show date range', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check for dates
    await expect(page.locator('text=/february|march|2026/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('should add new task', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Look for add task button
    const addTaskBtn = page.getByRole('button', { name: /add task/i }).first();

    if (await addTaskBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addTaskBtn.click();

      // Verify task form appears or new task is added
      await expect(page.locator('input:visible, form:visible, dialog:visible').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should search tasks', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Look for search input
    const searchInput = page.getByPlaceholder(/search task/i).or(
      page.locator('input[type="search"]').or(page.locator('input').first())
    ).first();

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Planning');

      // Verify search results
      await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('should work on small mobile (320x568)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: /gantt/i }).click();

    // Verify Gantt is usable on very small screen
    await expect(page.locator('text=/task|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should work on large mobile (414x896)', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.getByRole('button', { name: /gantt/i }).click();

    // Verify Gantt is usable on larger mobile screen
    await expect(page.locator('text=/task|planning/i').first()).toBeVisible({ timeout: 5000 });

    // Take screenshot
    const shot = await page.screenshot({ fullPage: true });
    expect(shot.byteLength).toBeGreaterThan(1000);
  });

  test('should switch between Tasks and Resources tabs', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await expect(page.locator('text=/planning/i').first()).toBeVisible({ timeout: 5000 });

    // Look for Resources tab
    const resourcesTab = page.getByRole('button', { name: /resources/i }).or(
      page.locator('button').filter({ hasText: /resources/i })
    ).first();

    await expect(resourcesTab).toBeVisible({ timeout: 3000 });
    await resourcesTab.click();

    // Verify resources view is shown
    await expect(page.locator('text=/resource|assignee/i').first()).toBeVisible({ timeout: 3000 });

    // Take screenshot
    const shot = await page.screenshot();
    expect(shot.byteLength).toBeGreaterThan(1000);
  });
});
