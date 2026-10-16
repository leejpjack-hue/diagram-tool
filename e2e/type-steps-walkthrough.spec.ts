import { expect, test } from '@playwright/test';

// DT-AI-16 smoke: Type steps → Build → success toast Walk through → Esc.
test.describe.configure({ timeout: 90_000 });

test('Build success toast Walk through starts and exits the walkthrough', async ({ page }) => {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.getByText('title: Untitled Workflow')).toBeVisible();

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill('Ask a question\nthen Draft an answer\nthen Send the reply');
  await page.getByTestId('build-steps').click();

  // Success toast keeps its text and gains the Walk through action.
  const toast = page.getByTestId('toast-item').filter({ hasText: 'Built 3 steps' });
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText('Built 3 steps onto the board');
  await expect(toast.getByTestId('toast-action')).toHaveAccessibleName('Walk through');

  await toast.getByTestId('toast-action').click();
  await expect(page.getByTestId('toast-item')).toHaveCount(0);
  await expect(page.getByTestId('walk-through-overlay')).toBeVisible();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 1 of 3');

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
});

// DT-AI-23: ?share=<token> read-only banner Walk through button on Flow boards
// (and hidden on non-walk boards). Uses preview server (4173) so Supabase client
// is initialized and RPC calls can be intercepted via page.route.
test('Shared read-only Flow banner offers Walk through, starts overlay, and keeps read-only after Exit', async ({ page }) => {
  const sharedFlowDsl = `diagram: flow
title: Shared AI Workflow
Ask -> Model
Model -> Check
Check ->|retry| Model
Check ->|ok| Reply
node Ask {
  label: "Human ask"
  role: human
}
node Model {
  label: "Model"
  role: model
}
node Check {
  type: decision
  label: "Check"
  role: check
}
node Reply {
  label: "Reply"
  role: human
}`;

  const sharedArchDsl = `diagram: architecture
title: Shared Arch
service Web { }`;

  await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
    const body = route.request().postDataJSON() as { p_token?: string } | null;
    const token = body?.p_token;
    if (token === 'tok_arch_23') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'shared-arch-id',
            title: 'Shared Arch',
            updated_at: '2026-10-16T09:00:00.000Z',
            payload: {
              version: '3.0',
              kind: 'board',
              exportedAt: '2026-10-16T09:00:00.000Z',
              watermark: null,
              requiresAccount: false,
              board: {
                title: 'Shared Arch',
                mode: 'architecture',
                dslText: sharedArchDsl,
                source: { kind: 'dsl', text: sharedArchDsl },
                nodes: [],
                edges: [],
                frames: [],
                comments: [],
                layout: { pins: {} },
              },
            },
          },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'shared-flow-id',
          title: 'Shared AI Workflow',
          updated_at: '2026-10-16T09:00:00.000Z',
          payload: {
            version: '3.0',
            kind: 'board',
            exportedAt: '2026-10-16T09:00:00.000Z',
            watermark: null,
            requiresAccount: false,
            board: {
              title: 'Shared AI Workflow',
              mode: 'flow',
              dslText: sharedFlowDsl,
              source: { kind: 'dsl', text: sharedFlowDsl },
              nodes: [],
              edges: [],
              frames: [],
              comments: [],
              layout: { pins: {} },
            },
          },
        },
      ]),
    });
  });

  await page.goto('http://127.0.0.1:4173/app/?share=tok_flow_23');
  const banner = page.getByTestId('shared-readonly-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Shared AI Workflow');
  await expect(banner.getByTestId('shared-save-local-copy')).toBeVisible();

  const walkBtn = banner.getByTestId('shared-walk-through');
  await expect(walkBtn).toBeVisible();
  await expect(walkBtn).toHaveAccessibleName('Walk through');

  await walkBtn.click();
  await expect(page.getByTestId('walk-through-overlay')).toBeVisible();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 1 of 5');
  await expect(page.getByTestId('walk-through-caption')).toContainText('Human ask');

  // Step to decision and choose a branch; trails and Copy path are present.
  await page.getByTestId('walk-through-next').click();
  await page.getByTestId('walk-through-next').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Step 3 of 5');
  await expect(page.getByTestId('walk-through-node-trail').first()).toHaveAttribute('data-node-id', 'ask');
  await page.getByTestId('walk-through-choose').getByTestId('walk-through-choose-1').click();
  await expect(page.getByTestId('walk-through-caption')).toContainText('Reply');
  await expect(page.getByTestId('walk-through-copy-path')).toBeVisible();

  // Exit leaves read-only shared banner intact.
  await page.getByTestId('walk-through-exit').click();
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
  await expect(banner).toBeVisible();

  // Non-walk shared board hides Walk through button with no toast spam.
  await page.goto('http://127.0.0.1:4173/app/?share=tok_arch_23');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Shared Arch');
  await expect(banner.getByTestId('shared-save-local-copy')).toBeVisible();
  await expect(banner.getByTestId('shared-walk-through')).toHaveCount(0);
  await expect(page.getByTestId('toast-item')).toHaveCount(0);
});
