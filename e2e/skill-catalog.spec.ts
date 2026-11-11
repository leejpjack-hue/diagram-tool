import { testTimeout } from './testTimeout';
import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { TypeToFlowResult } from '../src/utils/typeToFlow';

const input = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/input.json', import.meta.url), 'utf8')) as { text: string };
const output = JSON.parse(readFileSync(new URL('../fixtures/type-to-flow/spike-output.json', import.meta.url), 'utf8')) as TypeToFlowResult;
const catalog = JSON.parse(readFileSync(new URL('../fixtures/skills/catalog-type-to-flow.json', import.meta.url), 'utf8')) as {
  skills: { name: string; description: string; location: string }[];
};
const secondaryCatalog = JSON.parse(
  readFileSync(new URL('../fixtures/skills/catalog-secondary-type-to-flow.json', import.meta.url), 'utf8'),
) as {
  skills: { name: string; description: string; location: string; sourceId: string; version: string; checksum: string }[];
};
const skillBundle = JSON.parse(readFileSync(new URL('../skills/skills-bundle.json', import.meta.url), 'utf8')) as {
  id: string;
  prefix: string;
  packages: { name: string; version: string; checksum: string; location: string }[];
};
const emptyCatalog = JSON.parse(readFileSync(new URL('../fixtures/skills/catalog-empty.json', import.meta.url), 'utf8')) as { skills: unknown[] };
const reloadedCatalog = JSON.parse(readFileSync(new URL('../fixtures/skills/catalog-after-reload.json', import.meta.url), 'utf8')) as {
  skills: { name: string; description: string }[];
};

function frontmatterDescription(): string {
  const skill = readFileSync(new URL('../skills/type-to-flow/SKILL.md', import.meta.url), 'utf8');
  const description = skill.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!description) throw new Error('type-to-flow SKILL.md is missing a description');
  return description;
}

test.describe.configure({ timeout: testTimeout(120_000) });
test.use({ baseURL: process.env.PW_BASE_URL ?? 'http://localhost:5173' });

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
});

async function openBlankWorkflow(page: Page) {
  await page.goto('/app/');
  await page.getByRole('button', { name: 'Create new' }).click();
  await page.getByRole('button', { name: 'Blank Workflow Open a clean DSL canvas.' }).click();
}

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

test('catalog lists frontmatter and keyboard Activate maps the fixture graph', async ({ page }) => {
  expect(emptyCatalog.skills).toEqual([]);
  expect(catalog.skills[0]?.description).toBe(frontmatterDescription());

  const calls: string[] = [];
  let releaseActivate!: () => void;
  const activateHeld = new Promise<void>(resolve => {
    releaseActivate = resolve;
  });
  await page.route(/\/api\/skills(?:\?|$)/, route => fulfillJson(route, catalog));
  await page.route(/\/api\/skills\/type-to-flow\/activate$/, async route => {
    expect(route.request().method()).toBe('POST');
    calls.push('activate');
    await activateHeld;
    await fulfillJson(route, { content: '# type-to-flow\n' });
  });
  await page.route(/\/api\/skills\/type-to-flow\/run$/, async route => {
    expect(route.request().postDataJSON().text).toBe(input.text);
    calls.push('run');
    await fulfillJson(route, output);
  });

  await openBlankWorkflow(page);
  await expect(page.getByTestId('skill-name-type-to-flow')).toHaveText('type-to-flow');
  await expect(page.getByTestId('skill-description-type-to-flow')).toHaveText(catalog.skills[0].description);
  await expect(page.getByTestId('skill-catalog-reload-note')).toContainText('/workspace/.agents/skills');
  await expect(page.getByTestId('skill-catalog-reload-note')).toContainText('Worker redeploy');

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  const activate = page.getByRole('button', { name: 'Activate type-to-flow' });
  await page.getByTestId('skill-catalog-reload').focus();
  await page.keyboard.press('Tab');
  await expect(activate).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('skill-activate-progress')).toHaveText('Activating type-to-flow…');
  releaseActivate();

  await expect(page.locator('.react-flow__node')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.locator('.react-flow__node-decision')).toContainText('If a line is a decision?');
  await expect(page.getByTestId('skill-mermaid-pane')).toContainText(output.mermaid);
  await expect(page.getByTestId('skill-activate-note')).toContainText('mapped it onto this board');
  expect(calls).toEqual(['activate', 'run']);
});

test('a failed activate leaves the existing board untouched', async ({ page }) => {
  let runs = 0;
  await page.route(/\/api\/skills(?:\?|$)/, route => fulfillJson(route, catalog));
  await page.route(/\/api\/skills\/type-to-flow\/activate$/, route => fulfillJson(route, { error: 'Skill not found.' }, 404));
  await page.route(/\/api\/skills\/type-to-flow\/run$/, route => {
    runs += 1;
    return fulfillJson(route, output);
  });

  await openBlankWorkflow(page);
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill('Receive request');
  await page.getByRole('button', { name: 'Activate type-to-flow' }).click();
  await expect(page.getByTestId('skill-activate-error')).toHaveText('Skill not found.');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('.react-flow__node', { hasText: 'NextStep' })).toBeVisible();
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
  expect(runs).toBe(0);
});

test('a failed map after activate leaves the existing board untouched', async ({ page }) => {
  await page.route(/\/api\/skills(?:\?|$)/, route => fulfillJson(route, catalog));
  await page.route(/\/api\/skills\/type-to-flow\/activate$/, route => fulfillJson(route, { content: '# type-to-flow\n' }));
  await page.route(/\/api\/skills\/type-to-flow\/run$/, route => fulfillJson(route, { error: 'Skill unavailable.' }, 503));

  await openBlankWorkflow(page);
  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  await page.getByRole('button', { name: 'Activate type-to-flow' }).click();
  await expect(page.getByTestId('skill-activate-error')).toHaveText('Skill unavailable.');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.getByTestId('skill-mermaid-pane')).toHaveCount(0);
});

test('an empty skills tree shows where to add a skill folder', async ({ page }) => {
  await page.route(/\/api\/skills(?:\?|$)/, route => fulfillJson(route, emptyCatalog));
  await openBlankWorkflow(page);
  await expect(page.getByTestId('skill-catalog-empty')).toContainText('/workspace/.agents/skills/');
  await expect(page.getByTestId('skill-catalog-empty')).toContainText('SKILL.md');
  await expect(page.getByRole('button', { name: /Activate / })).toHaveCount(0);
});

test('reload shows a skill folder added without a worker redeploy', async ({ page }) => {
  await page.route(/\/api\/skills(?:\?|$)/, route => {
    const reload = new URL(route.request().url()).searchParams.get('reload') === '1';
    return fulfillJson(route, reload ? reloadedCatalog : catalog);
  });
  await openBlankWorkflow(page);
  await expect(page.getByTestId('skill-name-type-to-flow')).toBeVisible();
  await expect(page.getByTestId('skill-name-review-notes')).toHaveCount(0);
  const reloaded = page.waitForRequest(request => request.url().includes('/api/skills?reload=1'));
  await page.getByTestId('skill-catalog-reload').click();
  await reloaded;
  await expect(page.getByTestId('skill-name-review-notes')).toHaveText('review-notes');
  await expect(page.getByTestId('skill-description-review-notes')).toHaveText('Summarise a board in plain language.');
  await expect(page.getByTestId('skill-catalog-reload-note')).toContainText('does not change that runner until a Worker redeploy');
});

test('secondary agents:skills catalog loads type-to-flow on an unseeded Workspace and yields to Workspace precedence', async ({ page }) => {
  expect(secondaryCatalog.skills[0]?.checksum).toBe(skillBundle.packages[0]?.checksum);
  expect(secondaryCatalog.skills[0]?.version).toBe(skillBundle.packages[0]?.version);

  const dualSourceCatalog = {
    skills: [
      ...secondaryCatalog.skills,
      {
        name: 'type-to-flow',
        description: 'Workspace override wins over secondary bundle.',
        location: '/workspace/.agents/skills/type-to-flow',
        sourceId: 'workspace:/workspace/.agents/skills',
        version: '1.0.0-workspace',
      },
    ],
  };

  await page.route(/\/api\/skills(?:\?|$)/, route => {
    const reload = new URL(route.request().url()).searchParams.get('reload') === '1';
    return fulfillJson(route, reload ? dualSourceCatalog : secondaryCatalog);
  });
  await page.route(/\/api\/skills\/type-to-flow\/activate$/, route =>
    fulfillJson(route, { content: '<skill_content name="type-to-flow" location="agents:skills/type-to-flow">\n# type-to-flow\n</skill_content>' }),
  );
  await page.route(/\/api\/skills\/type-to-flow\/run$/, route => fulfillJson(route, output));

  await openBlankWorkflow(page);
  await expect(page.getByTestId('skill-name-type-to-flow')).toHaveText('type-to-flow');
  await expect(page.getByTestId('skill-location-type-to-flow')).toHaveText('agents:skills/type-to-flow');
  await expect(page.getByTestId('skill-description-type-to-flow')).toHaveText(secondaryCatalog.skills[0].description);

  await page.getByTestId('toggle-type-steps').click();
  await page.getByTestId('type-steps-input').fill(input.text);
  await page.getByRole('button', { name: 'Activate type-to-flow' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(7, { timeout: 20_000 });
  await expect(page.getByTestId('skill-activate-note')).toContainText('mapped it onto this board');

  const reloaded = page.waitForRequest(request => request.url().includes('/api/skills?reload=1'));
  await page.getByTestId('skill-catalog-reload').click();
  await reloaded;
  await expect(page.locator('[data-testid="skill-catalog-item-type-to-flow"]')).toHaveCount(1);
  await expect(page.getByTestId('skill-location-type-to-flow')).toHaveText('/workspace/.agents/skills/type-to-flow');
  await expect(page.getByTestId('skill-description-type-to-flow')).toHaveText('Workspace override wins over secondary bundle.');
});
