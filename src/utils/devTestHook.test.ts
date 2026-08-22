import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DIAGRAM_DSL_TEST_HOOK,
  canInstallDiagramDslTestHook,
  installDiagramDslTestHook,
} from './devTestHook';

const GET_HOOK = '__getDiagramDsl';
const here = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  const host = window as Window & { [DIAGRAM_DSL_TEST_HOOK]?: unknown; [GET_HOOK]?: unknown };
  delete host[DIAGRAM_DSL_TEST_HOOK];
  delete host[GET_HOOK];
});

describe('diagram DSL test hook', () => {
  it('is only enabled when import.meta.env.DEV is true', () => {
    expect(canInstallDiagramDslTestHook(false)).toBe(false);
    expect(canInstallDiagramDslTestHook(true)).toBe(true);
    expect(canInstallDiagramDslTestHook()).toBe(import.meta.env.DEV);
  });

  it('does not assign window.__setDiagramDsl or window.__getDiagramDsl when DEV is off', () => {
    const host = window as Window & {
      [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void;
      [GET_HOOK]?: () => string;
    };
    expect(installDiagramDslTestHook(() => undefined, false)).toBeUndefined();
    expect(host[DIAGRAM_DSL_TEST_HOOK]).toBeUndefined();
    expect(host[GET_HOOK]).toBeUndefined();
  });

  it('assigns window.__setDiagramDsl only when DEV is on', () => {
    const host = window as Window & {
      [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void;
      [GET_HOOK]?: () => string;
    };
    const cleanup = installDiagramDslTestHook(() => undefined, true);
    expect(typeof host[DIAGRAM_DSL_TEST_HOOK]).toBe('function');
    expect(host[GET_HOOK]).toBeUndefined();
    cleanup?.();
    expect(host[DIAGRAM_DSL_TEST_HOOK]).toBeUndefined();
  });

  it('DSLEditor and the helper gate the setter on import.meta.env.DEV and never install a getter', () => {
    const helper = readFileSync(join(here, 'devTestHook.ts'), 'utf8');
    const editor = readFileSync(join(here, '../components/Editor/DSLEditor.tsx'), 'utf8');
    const spec = readFileSync(join(here, '../../e2e/source-sync.spec.ts'), 'utf8');
    expect(helper).toMatch(/import\.meta\.env\.DEV/);
    expect(helper).not.toMatch(/__getDiagramDsl|DIAGRAM_DSL_GET_HOOK/);
    expect(editor).toMatch(/installDiagramDslTestHook/);
    expect(editor).not.toMatch(/host\.__setDiagramDsl\s*=/);
    expect(editor).not.toMatch(/__getDiagramDsl/);
    expect(spec).not.toMatch(/__getDiagramDsl/);
    expect(spec).not.toMatch(/__copiedText|__get[A-Z]/);
    expect(spec).toMatch(/getEditors\?\.\(\)\?\.\[0\]\?\.getValue\(\)/);
  });
});
