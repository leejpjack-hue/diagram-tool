import { expect, test } from '@playwright/test';

test.describe('Live /app workspace smoke', () => {
  test('dashboard Home -> Blank Architecture -> editor chrome -> reload with saved board (no React #185)', async ({
    page,
    baseURL,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(String(err)));
    page.on('console', msg => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    const targetUrl = new URL('/app/', baseURL ?? 'https://diagram-tool.teqcon.uk').toString();
    const response = await page.goto('/app/', { timeout: 30_000 }).catch((err: unknown) => {
      throw new Error(
        `Live target unreachable at ${targetUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    expect(
      response?.status(),
      `Expected live target ${targetUrl} to return HTTP 200, got ${response?.status() ?? 'no response'}`,
    ).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Home' }),
      `Expected /app/ dashboard Home heading to render at ${targetUrl}`,
    ).toBeVisible({ timeout: 30_000 });

    const blankArch = page.getByRole('button', { name: /Blank Architecture.*Start clean/i });
    await expect(blankArch, 'Expected Blank Architecture quick-create tile on Home').toBeVisible({ timeout: 15_000 });
    await blankArch.click();

    await expect(
      page.getByRole('button', { name: '⌂ Boards' }),
      'Expected editor Boards button after creating Blank Architecture',
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('button', { name: /^File$/i }).or(page.getByText('File')).first(),
      'Expected editor File menu chrome to be visible',
    ).toBeVisible({ timeout: 15_000 });

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length, 'Expected #root to contain rendered editor markup').toBeGreaterThan(500);
    await expect(
      page.locator('.react-flow').or(page.getByText(/diagram:\s*architecture/i)).first(),
      'Expected architecture canvas or DSL editor to be visible',
    ).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root'), 'Expected #root not to be empty after reload').not.toBeEmpty({ timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: 'Home' }),
      'Expected dashboard Home heading after reload',
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: 'Untitled Architecture' }).first(),
      'Expected saved Untitled Architecture board to persist across reload',
    ).toBeVisible({ timeout: 15_000 });

    const joined = pageErrors.join('\n');
    expect(joined, `Unexpected console/page errors:\n${joined}`).not.toMatch(
      /Maximum update depth|Minified React error #185|#185/i,
    );
  });
});
