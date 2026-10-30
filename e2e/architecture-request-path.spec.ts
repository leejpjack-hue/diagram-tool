import { testTimeout } from './testTimeout';
import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ timeout: testTimeout(90_000) });

const NUMBERED = `diagram: architecture
title: Request path walk
direction: LR
edges: orthogonal
service User {}
service App {}
service Agent {}
service Model {}
edge User -> App { label: "asks" step: 1 }
edge App -> Agent { label: "question" step: 2 }
edge Agent -> Model { label: "prompt" step: 3 }
edge Model -> User { label: "answer" step: 4 }
`;

const PLAIN = `diagram: architecture
title: Plain architecture
direction: LR
service User {}
service App {}
edge User -> App { label: "asks" }
`;

const HOPS = [
  { step: '1', edgeId: 'user_to_app_0', caption: '1 · User → App: asks', from: 'user', to: 'app', dim: 'agent' },
  { step: '2', edgeId: 'app_to_agent_1', caption: '2 · App → Agent: question', from: 'app', to: 'agent', dim: 'model' },
  { step: '3', edgeId: 'agent_to_model_2', caption: '3 · Agent → Model: prompt', from: 'agent', to: 'model', dim: 'user' },
  { step: '4', edgeId: 'model_to_user_3', caption: '4 · Model → User: answer', from: 'model', to: 'user', dim: 'agent' },
] as const;

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

async function openBlankArchitecture(page: Page) {
  await page.goto('/app/');
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Architecture Open a clean DSL canvas.' }).click();
}

async function expectBadges(page: Page) {
  await expect(page.getByTestId('architecture-step-badge')).toHaveCount(4);
  for (const hop of HOPS) {
    await expect(page.locator(`[data-testid="architecture-step-badge"][data-step="${hop.step}"]`)).toHaveCount(1);
  }
}

async function expectHop(page: Page, index: number) {
  const hop = HOPS[index];
  await expect(page.getByTestId('walk-through-caption')).toHaveText(hop.caption);
  await expect(page.getByTestId('walk-through-edge-active')).toHaveAttribute('data-edge-id', hop.edgeId);
  await expect(page.locator(`[data-testid="walk-through-node-current"][data-node-id="${hop.from}"]`)).toHaveCount(1);
  await expect(page.locator(`[data-testid="walk-through-node-current"][data-node-id="${hop.to}"]`)).toHaveCount(1);
  await expect(page.getByTestId(`rf__node-${hop.dim}`)).toHaveCSS('opacity', '0.15');
}

async function walkAllHops(page: Page) {
  await page.getByTestId('walk-through').click();
  await expectHop(page, 0);
  for (let index = 1; index < HOPS.length; index++) {
    await page.getByTestId('walk-through-next').click();
    await expectHop(page, index);
  }
}

/**
 * The localStorage pending-writes mirror is cleared once IndexedDB commits
 * (#102). Wait on the saved board itself so a fast commit cannot race the wait.
 */
async function waitForSavedNumberedBoard(page: Page) {
  await page.waitForFunction(async () => {
    try {
      return await new Promise<boolean>(resolve => {
        const request = indexedDB.open('diagram-tool-workspace');
        request.onerror = () => resolve(false);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('boards')) {
            db.close();
            resolve(false);
            return;
          }
          const getAll = db.transaction('boards', 'readonly').objectStore('boards').getAll();
          getAll.onerror = () => {
            db.close();
            resolve(false);
          };
          getAll.onsuccess = () => {
            const boards = getAll.result as Array<{ title?: string; dslText?: string }>;
            db.close();
            resolve(boards.some(board => {
              const dsl = board.dslText ?? '';
              return (board.title === 'Request path walk' || dsl.includes('title: Request path walk'))
                && dsl.includes('step: 1')
                && dsl.includes('step: 2')
                && dsl.includes('step: 3')
                && dsl.includes('step: 4');
            }));
          };
        };
      });
    } catch {
      return false;
    }
  }, undefined, { timeout: 15_000 });
}

test('numbered architecture path shows badges, walks each hop, survives reload, and hides Walk through without steps', async ({ page }) => {
  await openBlankArchitecture(page);
  await setEditorDsl(page, NUMBERED);
  await expect(page.getByTestId('rf__node-user')).toBeVisible();
  await expectBadges(page);
  await expect(page.getByTestId('walk-through')).toBeVisible();

  await walkAllHops(page);
  await expect(page.getByTestId('walk-through-copy-path')).toBeEnabled();

  await waitForSavedNumberedBoard(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  await page.getByRole('heading', { name: 'Request path walk' }).first().click();
  await waitForEditor(page);
  await expectBadges(page);
  await expect(page.getByTestId('walk-through')).toBeVisible();
  await walkAllHops(page);

  await setEditorDsl(page, PLAIN);
  await expect(page.getByTestId('rf__node-user')).toBeVisible();
  await expect(page.getByTestId('architecture-step-badge')).toHaveCount(0);
  await expect(page.getByTestId('walk-through')).toHaveCount(0);
});

test('shared read-only architecture board can walk a numbered path', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_diagram_by_share_token*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'shared-arch-path',
          title: 'Request path walk',
          updated_at: '2026-10-18T09:00:00.000Z',
          payload: {
            version: '3.0',
            kind: 'board',
            exportedAt: '2026-10-18T09:00:00.000Z',
            watermark: null,
            requiresAccount: false,
            board: {
              title: 'Request path walk',
              mode: 'architecture',
              dslText: NUMBERED,
              source: { kind: 'dsl', text: NUMBERED },
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

  await page.goto(new URL('/app/?share=tok_arch_02', process.env.PW_BASE_URL ?? 'http://127.0.0.1:4173').toString());
  const banner = page.getByTestId('shared-readonly-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Request path walk');
  const walkBtn = banner.getByTestId('shared-walk-through');
  await expect(walkBtn).toBeVisible();
  await walkBtn.click();
  await expectHop(page, 0);
  await page.getByTestId('walk-through-next').click();
  await expectHop(page, 1);
  await page.getByTestId('walk-through-exit').click();
  await expect(page.getByTestId('walk-through-overlay')).toHaveCount(0);
  await expect(banner).toBeVisible();
  await expect(banner.getByTestId('shared-save-local-copy')).toBeVisible();
});
