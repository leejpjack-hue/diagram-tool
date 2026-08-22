export const DIAGRAM_DSL_TEST_HOOK = '__setDiagramDsl';
export const DIAGRAM_DSL_GET_HOOK = '__getDiagramDsl';

export function canInstallDiagramDslTestHook(dev = import.meta.env.DEV): boolean {
  return dev === true;
}

/** Playwright-only seam. Production calls pass `import.meta.env.DEV` (false). */
export function installDiagramDslTestHook(
  setter: (text: string) => void,
  enabled = canInstallDiagramDslTestHook(),
  getter?: () => string,
): (() => void) | undefined {
  if (!enabled) return undefined;
  const host = window as Window & {
    [DIAGRAM_DSL_TEST_HOOK]?: (text: string) => void;
    [DIAGRAM_DSL_GET_HOOK]?: () => string;
  };
  host[DIAGRAM_DSL_TEST_HOOK] = setter;
  if (getter) host[DIAGRAM_DSL_GET_HOOK] = getter;
  return () => {
    delete host[DIAGRAM_DSL_TEST_HOOK];
    delete host[DIAGRAM_DSL_GET_HOOK];
  };
}
