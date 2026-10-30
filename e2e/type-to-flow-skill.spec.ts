import { testTimeout } from './testTimeout';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { TypeToFlowResult } from '../src/utils/typeToFlow';

const input = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/input.json', import.meta.url), 'utf8')) as { text: string };
const output = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/spike-output.json', import.meta.url), 'utf8')) as TypeToFlowResult;

test.describe.configure({ timeout: testTimeout(120_000) });
test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173' });

// The skill path has no dependency on externally hosted fonts.
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
});

test('workflow skill response produces the spike graph and shows Mermaid', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/skills/type-to-flow/run', async route => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.postDataJSON().text).toBe(input.text);
    calls++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(output) });
  });

  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  await expect(page.getByTestId('type-steps-preview-summary')).toContainText('7 steps', { timeout: 20_000 });
  await page.getByTestId('run-type-to-flow').click();

  await expect(page.locator('.react-flow__node')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.locator('.react-flow__node-start')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-flow')).toHaveCount(4);
  await expect(page.locator('.react-flow__node-decision')).toHaveCount(1);
  await expect(page.locator('.react-flow__node-end')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  await expect(page.locator('.react-flow__node-decision')).toContainText('If a line is a decision?');
  await expect(page.getByTestId('skill-mermaid-pane')).toContainText(output.mermaid);
  expect(calls).toBe(1);

  // Reopening the saved board proves that the graph survives the normal DSL
  // persistence path without requiring the injected skill response again.
  await page.getByRole('button', { name: '⌂ Boards' }).click();
  await page.getByRole('button', { name: new RegExp(output.flow.title) }).first().click();
  await expect(page.locator('.react-flow__node')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.locator('.react-flow__node-decision')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  expect(calls).toBe(1);
});

test('a failed skill run leaves the existing board untouched', async ({ page }) => {
  await page.route('**/api/skills/type-to-flow/run', route => route.fulfill({ status: 503, json: { error: 'Skill unavailable.' } }));
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill('Receive request');
  await page.getByTestId('run-type-to-flow').click();
  await expect(page.getByText('Skill unavailable.')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node', { hasText: 'NextStep' })).toBeVisible();
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
});

test('a malformed decision result leaves the existing board untouched', async ({ page }) => {
  const invalid = structuredClone(output);
  invalid.flow.edges = invalid.flow.edges.filter(edge => !(edge.from === 'n3' && edge.label === 'no'));
  await page.route('**/api/skills/type-to-flow/run', route => route.fulfill({ json: invalid }));
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  await page.getByTestId('run-type-to-flow').click();
  await expect(page.getByText('Each decision needs at least two labeled outgoing edges.')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
});

test('changing the steps during a skill run prevents a stale board replacement', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/skills/type-to-flow/run', async route => {
    await pending;
    await route.fulfill({ json: output });
  });
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  const sent = page.waitForRequest('**/api/skills/type-to-flow/run');
  await page.getByTestId('run-type-to-flow').click();
  await sent;
  await page.getByTestId('type-steps-input').fill('A newer workflow');
  release();
  await expect(page.getByText('The board or steps changed while the skill was running. Run it again.')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
});
