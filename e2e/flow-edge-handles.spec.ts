import { testTimeout } from './testTimeout';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.describe.configure({ timeout: testTimeout(90_000) });

const HORIZONTAL = `diagram: flow
title: Short Horizontal
direction: TB
Alpha -> Beta
node Alpha {
  label: Alpha
  at: 80, 180
}
node Beta {
  label: Beta
  at: 480, 180
}
`;

const VERTICAL = `diagram: flow
title: Short Vertical
direction: TB
Alpha -> Beta
node Alpha {
  label: Alpha
  at: 220, 80
}
node Beta {
  label: Beta
  at: 220, 360
}
`;

const RECONNECT = `diagram: flow
title: Reconnect Sides
direction: TB
node Alpha {
  label: Alpha
  at: 80, 160
}
node Beta {
  label: Beta
  at: 460, 160
}
node Gamma {
  label: Gamma
  at: 80, 420
}
`;

const LEGACY_DSL = `diagram: flow
title: Legacy Flow Sides
direction: TB
Alpha -> Beta
node Alpha {
  label: Alpha
  at: 80, 180
}
node Beta {
  label: Beta
  at: 480, 180
}
`;

async function waitForEditor(page: Page) {
  await expect(page.getByRole('button', { name: '⌂ Boards' })).toBeVisible();
  await page.waitForFunction(() => {
    const monaco = (window as unknown as { monaco?: { editor?: { getEditors?: () => unknown[] } } }).monaco;
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

async function openBlankFlow(page: Page, dsl: string) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
  await setEditorDsl(page, dsl);
  await expect(page.getByTestId('rf__node-alpha')).toBeVisible();
  await expect(page.getByTestId('rf__node-beta')).toBeVisible();
  await page.getByTestId('fit-to-screen').click();
  await page.waitForTimeout(450);
}

function edgeWithSides(page: Page, source: string, target: string): Locator {
  return page.locator(`.react-flow__edge.flow-source-side-${source}.flow-target-side-${target}`);
}

async function drag(page: Page, from: Locator, to: Locator) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  expect(start).toBeTruthy();
  expect(end).toBeTruthy();
  await page.mouse.move(start!.x + start!.width / 2, start!.y + start!.height / 2);
  await page.mouse.down();
  await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 24 });
  await page.mouse.up();
}

test('A left of B attaches A-right to B-left', async ({ page }) => {
  await openBlankFlow(page, HORIZONTAL);
  await expect(page.getByTestId('rf__node-alpha').getByTestId('flow-handle-source-right-0')).toBeVisible();
  await expect(page.getByTestId('rf__node-beta').getByTestId('flow-handle-target-left-0')).toBeVisible();
  await expect(edgeWithSides(page, 'right', 'left')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge-smoothstep, .react-flow__edge-step')).toHaveCount(1);
});

test('A above B attaches A-bottom to B-top', async ({ page }) => {
  await openBlankFlow(page, VERTICAL);
  await expect(edgeWithSides(page, 'bottom', 'top')).toHaveCount(1);
});

test('drag-connect and reconnect update the attachment', async ({ page }) => {
  await openBlankFlow(page, RECONNECT);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);

  await drag(
    page,
    page.getByTestId('rf__node-alpha').getByTestId('flow-handle-source-right-0'),
    page.getByTestId('rf__node-beta').getByTestId('flow-handle-target-left-0'),
  );
  await expect(edgeWithSides(page, 'right', 'left')).toHaveCount(1);

  const updater = page.locator('.react-flow__edgeupdater-target');
  await expect(updater).toHaveCount(1);
  await drag(
    page,
    updater,
    page.getByTestId('rf__node-gamma').getByTestId('flow-handle-target-top-0'),
  );

  await expect(edgeWithSides(page, 'right', 'top')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge.flow-target-side-left')).toHaveCount(0);
});

test('reload re-infers the short path from positions', async ({ page }) => {
  await openBlankFlow(page, HORIZONTAL);
  await expect(edgeWithSides(page, 'right', 'left')).toHaveCount(1);

  const alpha = await page.getByTestId('rf__node-alpha').boundingBox();
  const beta = await page.getByTestId('rf__node-beta').boundingBox();
  expect(alpha).toBeTruthy();
  expect(beta).toBeTruthy();
  const startX = beta!.x + beta!.width / 2;
  const startY = beta!.y + beta!.height * 0.45;
  const endX = alpha!.x + alpha!.width / 2;
  const endY = alpha!.y + alpha!.height + 200;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 24 });
  await page.mouse.up();

  await expect(edgeWithSides(page, 'bottom', 'top')).toHaveCount(1, { timeout: 10_000 });
  // Live autosave writes the new pins before a reload can see them.
  await page.waitForTimeout(1200);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Short Horizontal' }).first().click();
  await waitForEditor(page);
  await expect(page.getByTestId('rf__node-alpha')).toBeVisible();
  await page.getByTestId('fit-to-screen').click();
  await page.waitForTimeout(450);
  await expect(edgeWithSides(page, 'bottom', 'top')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});

test('a legacy board with no sides loads on the short path', async ({ page }) => {
  const path = join(tmpdir(), `diagram-tool-legacy-flow-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify({
    version: '3.0',
    kind: 'board',
    exportedAt: '2026-01-01T00:00:00.000Z',
    board: {
      title: 'Legacy Flow Sides',
      mode: 'flow',
      dslText: LEGACY_DSL,
      source: { kind: 'dsl', text: LEGACY_DSL },
      nodes: [
        { id: 'alpha', name: 'Alpha', type: 'flow', x: 80, y: 180 },
        { id: 'beta', name: 'Beta', type: 'flow', x: 480, y: 180 },
      ],
      edges: [{ id: 'alpha_to_beta_0', from: 'alpha', to: 'beta' }],
      frames: [],
      comments: [],
    },
  }));

  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('dashboard-import').click(),
  ]);
  await fileChooser.setFiles(path);
  await expect(page.getByText(/Imported “Legacy Flow Sides”/)).toBeVisible();
  await page.getByRole('heading', { name: 'Legacy Flow Sides' }).first().click();
  await waitForEditor(page);
  await expect(page.getByTestId('rf__node-alpha')).toBeVisible();
  await page.getByTestId('fit-to-screen').click();
  await page.waitForTimeout(450);
  await expect(edgeWithSides(page, 'right', 'left')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});
