import { expect, test, type Page } from '@playwright/test';

const FAR_NODE_DSL = `diagram: architecture
title: Fit Check
service Near {
  at: 40, 100
}
service Far {
  at: 3200, 80
}`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => { setValue: (value: string) => void }[] } } }).monaco;
    return Boolean(monaco?.editor?.getEditors?.()?.length);
  });
}

async function setEditorDsl(page: Page, dsl: string) {
  await waitForEditor(page);
  await page.waitForFunction(() => typeof (window as unknown as { __setDiagramDsl?: unknown }).__setDiagramDsl === 'function');
  await page.evaluate(value => {
    (window as unknown as { __setDiagramDsl: (text: string) => void }).__setDiagramDsl(value);
  }, dsl);
}

function isInside(box: { x: number; y: number; width: number; height: number }, frame: { x: number; y: number; width: number; height: number }) {
  return box.x + box.width > frame.x
    && box.x < frame.x + frame.width
    && box.y + box.height > frame.y
    && box.y < frame.y + frame.height;
}

test.describe('Workspace title, fit, and File menu', () => {
  test.describe.configure({ timeout: 60_000 });

  test('applying AWS 3-Tier sets the Home title from source, not Untitled', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await waitForEditor(page);
    await expect(page.getByText('title: Untitled Architecture')).toBeVisible();

    await page.getByRole('button', { name: 'Templates' }).click();
    await page.getByRole('heading', { name: 'Template Gallery' }).waitFor();
    await page.getByRole('button', { name: /AWS 3-Tier Web Application/ }).click();
    await expect(page.getByText('title: AWS 3-Tier Web App')).toBeVisible();

    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Untitled/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'AWS 3-Tier Web App' })).toBeVisible();
    await expect(page.getByTestId('board-mode-tag')).toHaveText(/Architecture/i);

    await page.getByRole('heading', { name: 'AWS 3-Tier Web App' }).click();
    await page.getByRole('button', { name: 'Flow', exact: true }).click();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByTestId('board-mode-tag')).toHaveText(/Workflow/i);
  });

  test('editing title: updates the Home board name', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await setEditorDsl(page, 'diagram: architecture\ntitle: Claims Platform\nservice API {}');
    await expect(page.getByText('title: Claims Platform')).toBeVisible();
    await page.getByRole('button', { name: '⌂ Boards' }).click();
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Claims Platform' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Untitled/i })).toHaveCount(0);
  });

  test('Fit to Screen brings an off-screen node into view', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await setEditorDsl(page, FAR_NODE_DSL);
    await expect(page.getByTestId('rf__node-near')).toBeVisible();
    await expect(page.getByTestId('rf__node-far')).toBeAttached();

    const canvas = page.locator('.react-flow');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).toBeTruthy();
    const farBefore = await page.getByTestId('rf__node-far').boundingBox();
    expect(farBefore).toBeTruthy();
    expect(isInside(farBefore!, canvasBox!)).toBe(false);

    await page.getByTestId('fit-to-screen').click();
    await page.waitForTimeout(400);

    const farAfter = await page.getByTestId('rf__node-far').boundingBox();
    const canvasAfter = await canvas.boundingBox();
    expect(farAfter).toBeTruthy();
    expect(canvasAfter).toBeTruthy();
    expect(isInside(farAfter!, canvasAfter!)).toBe(true);
  });

  test('flow decision labels stay horizontal', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
    await setEditorDsl(page, `diagram: flow
title: User Signup
direction: LR
start Begin
Begin -> ValidateEmail
ValidateEmail ->|Valid| CreateAccount
ValidateEmail ->|Invalid| ShowError
node ValidateEmail {
  type: decision
  label: Email Valid?
}`);
    await page.getByTestId('fit-to-screen').click();
    await page.waitForTimeout(400);
    await expect(page.getByText('Email Valid?')).toBeVisible();
    await expect(page.getByText('Valid', { exact: true })).toBeVisible();

    const decisionLabel = page.getByText('Email Valid?');
    const transform = await decisionLabel.evaluate(el => getComputedStyle(el).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();

    const edgeLabel = page.locator('.flow-edge-label, .react-flow__edge-label, .react-flow__edge-text').filter({ hasText: 'Valid' }).first();
    await expect(edgeLabel).toBeVisible();
    const edgeTransform = await edgeLabel.evaluate(el => getComputedStyle(el).transform);
    expect(edgeTransform.includes('matrix(0.') || /rotate\(/.test(edgeTransform)).toBeFalsy();
  });

  test('Escape dismisses the File menu', async ({ page }) => {
    await page.goto('/app/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
    await waitForEditor(page);

    await page.getByRole('button', { name: 'File' }).click();
    await expect(page.getByTestId('file-menu')).toBeVisible();
    await expect(page.getByText('New diagram')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save As…' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload from disk' })).toBeDisabled();
    await expect(page.getByText(/DIAGRAM_TOOL_DIR points at/)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('file-menu')).toHaveCount(0);
  });
});
