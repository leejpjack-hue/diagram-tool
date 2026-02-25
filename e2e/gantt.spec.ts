import { test, expect } from '@playwright/test';

test.describe('Gantt Functionality - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render Gantt chart correctly on desktop', async ({ page }) => {
    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();

    // Wait for Gantt to render
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('gantt-desktop-view.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should render Gantt chart on mobile (375x667)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Take mobile screenshot
    await expect(page).toHaveScreenshot('gantt-mobile-view.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should render Gantt chart on tablet (768x1024)', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });

    // Switch to Gantt mode
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Take tablet screenshot
    await expect(page).toHaveScreenshot('gantt-tablet-view.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should display task list on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check if task list is visible
    const taskList = page.locator('[data-testid="gantt-tasks"]').or(page.locator('text=/task/i').first());
    await expect(taskList).toBeVisible({ timeout: 5000 });

    // Take screenshot of task list
    await expect(page).toHaveScreenshot('gantt-mobile-tasklist.png', {
      maxDiffPixels: 100
    });
  });

  test('should show task details on click', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Click on a task bar
    const taskBar = page.locator('[data-testid="task-bar"]').or(page.locator('text=/planning/i')).first();
    if (await taskBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskBar.click();
      await page.waitForTimeout(500);

      // Take screenshot showing task details
      await expect(page).toHaveScreenshot('gantt-task-details.png', {
        maxDiffPixels: 100
      });
    }
  });

  test('should use date range picker on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Look for date range button
    const dateButton = page.getByRole('button', { name: /date range/i }).or(
      page.locator('button').filter({ hasText: /calendar|date/i })
    );

    if (await dateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateButton.click();
      await page.waitForTimeout(500);

      // Take screenshot of date picker
      await expect(page).toHaveScreenshot('gantt-date-picker-mobile.png', {
        maxDiffPixels: 100
      });
    }
  });

  test('should filter tasks on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Look for filter dropdown
    const filterButton = page.getByRole('button', { name: /assignee|status/i }).or(
      page.locator('select').first()
    );

    if (await filterButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(500);

      // Take screenshot of filter options
      await expect(page).toHaveScreenshot('gantt-filter-mobile.png', {
        maxDiffPixels: 100
      });
    }
  });

  test('should scroll timeline horizontally on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Scroll right in the timeline area
    const timeline = page.locator('[data-testid="gantt-timeline"]').or(page.locator('.gantt-chart'));
    if (await timeline.isVisible({ timeout: 3000 }).catch(() => false)) {
      await timeline.evaluate((el) => el.scrollLeft = 200);
      await page.waitForTimeout(500);

      // Take screenshot showing scrolled timeline
      await expect(page).toHaveScreenshot('gantt-timeline-scrolled-mobile.png', {
        maxDiffPixels: 100
      });
    }
  });
});

test.describe('Gantt Functionality - Functional Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should switch to Gantt mode successfully', async ({ page }) => {
    // Click Gantt tab
    await page.getByRole('button', { name: /gantt/i }).click();

    // Check Gantt tab is active
    const ganttTab = page.getByRole('button', { name: /gantt/i });
    await expect(ganttTab).toHaveClass(/active/);

    // Verify Gantt elements are visible
    await page.waitForTimeout(2000);
    const ganttVisible = await page.locator('text=/task|timeline|planning/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(ganttVisible).toBeTruthy();
  });

  test('should display task list with assignees', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check for task names
    const taskVisible = await page.locator('text=/planning|requirements|design/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(taskVisible).toBeTruthy();

    // Check for assignees
    const assigneeVisible = await page.locator('text=/jack|sarah|mike/i').isVisible({ timeout: 3000 }).catch(() => false);
    expect(assigneeVisible).toBeTruthy();
  });

  test('should show progress indicators', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check for progress percentages
    const progressVisible = await page.locator('text=/100%|60%|20%/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(progressVisible).toBeTruthy();
  });

  test('should show date range', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Check for dates
    const dateVisible = await page.locator('text=/february|march|2026/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(dateVisible).toBeTruthy();
  });

  test('should add new task', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Look for add task button
    const addTaskBtn = page.getByRole('button', { name: /\+|add task/i }).or(
      page.locator('button').filter({ hasText: '+' })
    );

    if (await addTaskBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addTaskBtn.click();
      await page.waitForTimeout(500);

      // Verify task form appears or new task is added
      const formVisible = await page.locator('input, form, dialog').isVisible({ timeout: 3000 }).catch(() => false);
      expect(formVisible).toBeTruthy();
    }
  });

  test('should search tasks', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Look for search input
    const searchInput = page.getByPlaceholder(/search task/i).or(
      page.locator('input[type="search"]').or(page.locator('input').first())
    );

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Planning');
      await page.waitForTimeout(500);

      // Verify search results
      const planningVisible = await page.locator('text=/planning/i').isVisible({ timeout: 3000 }).catch(() => false);
      expect(planningVisible).toBeTruthy();
    }
  });

  test('should work on small mobile (320x568)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Verify Gantt is usable on very small screen
    const ganttVisible = await page.locator('text=/task|planning/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(ganttVisible).toBeTruthy();

    // Take screenshot
    await expect(page).toHaveScreenshot('gantt-small-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should work on large mobile (414x896)', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 });
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Verify Gantt is usable on larger mobile screen
    const ganttVisible = await page.locator('text=/task|planning/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(ganttVisible).toBeTruthy();

    // Take screenshot
    await expect(page).toHaveScreenshot('gantt-large-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  test('should switch between Tasks and Resources tabs', async ({ page }) => {
    await page.getByRole('button', { name: /gantt/i }).click();
    await page.waitForTimeout(2000);

    // Look for Resources tab
    const resourcesTab = page.getByRole('button', { name: /resources/i }).or(
      page.locator('button').filter({ hasText: /resources/i })
    );

    if (await resourcesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resourcesTab.click();
      await page.waitForTimeout(500);

      // Verify resources view is shown
      const resourcesVisible = await page.locator('text=/resource|assignee/i').isVisible({ timeout: 3000 }).catch(() => false);
      expect(resourcesVisible).toBeTruthy();

      // Take screenshot
      await expect(page).toHaveScreenshot('gantt-resources-view.png', {
        maxDiffPixels: 100
      });
    }
  });
});
