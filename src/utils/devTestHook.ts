export const DIAGRAM_DSL_TEST_HOOK = '__setDiagramDsl';

export function canInstallDiagramDslTestHook(dev = import.meta.env.DEV): boolean {
  return dev === true;
}

/** Playwright-only seam. Production calls pass `import.meta.env.DEV` (false). */
export function installDiagramDslTestHook(
  setter: (text: string) => void,
  enabled = canInstallDiagramDslTestHook(),
): (() => void) | undefined {
  if (!enabled) return undefined;
  const host = window as Window & { [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void };
  host[DIAGRAM_DSL_TEST_HOOK] = setter;
  return () => { delete host[DIAGRAM_DSL_TEST_HOOK]; };
}
