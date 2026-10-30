import { expect, test } from '@playwright/test';

test.describe('P0 marketing landing', () => {
  test('cold / HTML includes signed copy and not workspace Home', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('Turn text into architecture, flow, and Gantt diagrams.');
    expect(html).toContain('Open the app');
    expect(html).not.toContain('Join the waitlist');
    expect(html).not.toContain('/api/waitlist');
    expect(html).not.toContain('>Home<');
    expect(html).not.toContain('Local workspace</div>');
  });

  test('/app is the local workspace', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Turn text into architecture, flow, and Gantt diagrams.' })).toHaveCount(0);
  });

  test('landing CTA opens /app', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Open the app', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('/api/waitlist is not served', async ({ request }) => {
    const get = await request.get('/api/waitlist');
    expect(get.status()).toBe(404);
    const post = await request.post('/api/waitlist', {
      data: { email: 'jack@company.com' },
    });
    expect(post.status()).toBe(404);
  });

  test('production preview bakes GA4 and serves the Open the app CTA', async ({ page, request }) => {
    const preview = process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173';
    const html = await (await request.get(`${preview}/`)).text();
    expect(html).toContain('Open the app');
    expect(html).not.toContain('Join the waitlist');
    expect(html).not.toContain('/api/waitlist');
    expect(html).toMatch(/src="\/assets\/main-[^"]+\.js"/);

    const jsPath = html.match(/src="(\/assets\/main-[^"]+\.js)"/)?.[1];
    expect(jsPath).toBeTruthy();
    const js = await (await request.get(`${preview}${jsPath}`)).text();
    expect(js).toContain('G-HLTGGMPREJ');
    expect(js).toContain('googletagmanager.com/gtag/js');
    expect(js).not.toContain('waitlist_submit_');

    await page.goto(preview);
    await expect(page.locator('#ga4-gtag')).toHaveAttribute(
      'src',
      /googletagmanager\.com\/gtag\/js\?id=G-HLTGGMPREJ/,
    );
    const cta = page.getByRole('link', { name: 'Open the app', exact: true });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/app');
  });
});
