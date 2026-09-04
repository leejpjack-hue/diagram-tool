import { expect, test } from '@playwright/test';

test.describe('P0 marketing landing', () => {
  test('cold / HTML includes signed copy and not workspace Home', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('Turn text into architecture, flow, and Gantt diagrams.');
    expect(html).toContain('Join the waitlist');
    expect(html).not.toContain('>Home<');
    expect(html).not.toContain('Local workspace</div>');
  });

  test('/app is the local workspace', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Turn text into architecture, flow, and Gantt diagrams.' })).toHaveCount(0);
  });

  test('waitlist endpoint exists and persists a valid email', async ({ request }) => {
    const probe = await request.get('/api/waitlist');
    expect(probe.ok()).toBeTruthy();
    expect(await probe.json()).toMatchObject({ ok: true, service: 'waitlist' });

    const created = await request.post('/api/waitlist', {
      data: {
        email: 'jack@company.com',
        note: 'AWS architecture',
        utm_source: 'e2e',
      },
    });
    expect(created.status()).toBe(201);
    expect(await created.json()).toEqual({ ok: true });

    const invalid = await request.post('/api/waitlist', { data: { email: 'nope' } });
    expect(invalid.status()).toBe(400);
  });

  test('successful submit replaces the form and does not navigate', async ({ page }) => {
    await page.goto('/?utm_source=hero');
    await page.getByPlaceholder('you@company.com').fill('you@company.com');
    await page.getByPlaceholder('e.g. AWS architecture, sprint Gantt…').fill('sprint Gantt');
    await page.getByRole('button', { name: 'Join waitlist', exact: true }).click();
    await expect(page.getByText('You’re on the list. We’ll email when accounts/sync ship.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join waitlist', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/(\?utm_source=hero)?$/);
    await expect(page.getByRole('link', { name: 'Open the workspace →' }).first()).toHaveAttribute('href', '/app');
  });
});
