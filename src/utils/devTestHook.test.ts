import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DIAGRAM_DSL_TEST_HOOK,
  canInstallDiagramDslTestHook,
  installDiagramDslTestHook,
} from './devTestHook';

const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  delete (window as Window & { [DIAGRAM_DSL_TEST_HOOK]?: unknown })[DIAGRAM_DSL_TEST_HOOK];
});

describe('diagram DSL test hook', () => {
  it('is only enabled when import.meta.env.DEV is true', () => {
    expect(canInstallDiagramDslTestHook(false)).toBe(false);
    expect(canInstallDiagramDslTestHook(true)).toBe(true);
    expect(canInstallDiagramDslTestHook()).toBe(import.meta.env.DEV);
  });

  it('does not assign window.__setDiagramDsl when DEV is off', () => {
    const host = window as Window & { [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void };
    expect(installDiagramDslTestHook(() => undefined, false)).toBeUndefined();
    expect(host[DIAGRAM_DSL_TEST_HOOK]).toBeUndefined();
  });

  it('assigns window.__setDiagramDsl only when DEV is on', () => {
    const host = window as Window & { [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void };
    const cleanup = installDiagramDslTestHook(() => undefined, true);
    expect(typeof host[DIAGRAM_DSL_TEST_HOOK]).toBe('function');
    cleanup?.();
    expect(host[DIAGRAM_DSL_TEST_HOOK]).toBeUndefined();
  });

  it('DSLEditor and the helper gate the hook on import.meta.env.DEV', () => {
    const helper = readFileSync(join(here, 'devTestHook.ts'), 'utf8');
    const editor = readFileSync(join(here, '../components/Editor/DSLEditor.tsx'), 'utf8');
    expect(helper).toMatch(/import\.meta\.env\.DEV/);
    expect(editor).toMatch(/installDiagramDslTestHook/);
    expect(editor).not.toMatch(/host\.__setDiagramDsl\s*=/);
  });
});
