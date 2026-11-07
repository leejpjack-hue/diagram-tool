import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { TypeToFlowResult } from '../src/utils/typeToFlow';

const input = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/ambiguous-decision-input.json', import.meta.url), 'utf8')) as { text: string; title: string };
const output = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/ambiguous-decision.json', import.meta.url), 'utf8')) as TypeToFlowResult;
const sentence = output.ambiguities?.[0]?.sentence ?? '';
const WRONG_NO_EDGE = 'n2 ->|"no"| n4';

test.describe.configure({ timeout: testTimeout(120_000) });
test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173' });

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
  await page.route('**/api/skills/type-to-flow/run', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON().text).toBe(input.text);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(output) });
  });
});

async function openBlankWorkflow(page: Page) {
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect.poll(() => editorSource(page)).toContain('NextStep -> Done');
}

async function editorSource(page: Page): Promise<string> {
  return page.evaluate(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { getValue: () => string }[] } } }).monaco;
    return monaco?.editor?.getEditors?.()?.[0]?.getValue() ?? '';
  });
}

async function runAmbiguous(page: Page) {
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  await page.getByTestId('run-type-to-flow').click();
  await expect(page.getByTestId('ambiguity-list')).toBeVisible();
  await expect(page.getByTestId('ambiguity-name')).toHaveText(output.ambiguities?.[0]?.id ?? 'n2');
  await expect(page.getByTestId('ambiguity-sentence')).toHaveText(sentence);
  await expect(page.locator('.react-flow__node-decision')).toHaveCount(0);
}

test('cancel leaves the prior graph intact and does not commit the inferred no branch', async ({ page }) => {
  await openBlankWorkflow(page);
  const prior = await editorSource(page);
  expect(prior).toContain('NextStep -> Done');
  expect(prior).not.toContain('|"no"|');

  await runAmbiguous(page);
  expect(await editorSource(page)).toBe(prior);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);

  await page.getByTestId('ambiguity-cancel').click();
  await expect(page.getByTestId('ambiguity-list')).toHaveCount(0);
  expect(await editorSource(page)).toBe(prior);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node', { hasText: 'NextStep' })).toBeVisible();
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
});

test('confirm is required before the inferred no branch is written', async ({ page }) => {
  await openBlankWorkflow(page);
  const prior = await editorSource(page);
  await runAmbiguous(page);
  expect(await editorSource(page)).toBe(prior);
  expect(await editorSource(page)).not.toContain(WRONG_NO_EDGE);

  await page.getByTestId('ambiguity-confirm').click();
  await expect(page.locator('.react-flow__node-decision')).toContainText('If approved?', { timeout: 20_000 });
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  const committed = await editorSource(page);
  expect(committed).toContain(WRONG_NO_EDGE);
  expect(committed).not.toBe(prior);
  await expect(page.getByTestId('skill-mermaid-pane')).toContainText('n2 -->|"no"| n4');
  await expect(page.getByTestId('ambiguity-list')).toHaveCount(0);
});

test('editing the no branch commits that target instead of the inferred end', async ({ page }) => {
  await openBlankWorkflow(page);
  const prior = await editorSource(page);
  await runAmbiguous(page);
  expect(await editorSource(page)).not.toContain(WRONG_NO_EDGE);

  await page.getByTestId('ambiguity-no-target-n2').selectOption('n3');
  expect(await editorSource(page)).toBe(prior);
  await page.getByTestId('ambiguity-confirm').click();

  await expect(page.locator('.react-flow__node-decision')).toContainText('If approved?', { timeout: 20_000 });
  const committed = await editorSource(page);
  expect(committed).toContain('n2 ->|"no"| n3');
  expect(committed).not.toContain(WRONG_NO_EDGE);
  await expect(page.getByTestId('skill-mermaid-pane')).toContainText('n2 -->|"no"| n3');
});
