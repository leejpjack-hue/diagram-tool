/**
 * DT-AI-11: Type steps panel visibility after a Build board attempt.
 *
 * Successful Build keeps the panel open so the user can iterate create.
 * Empty input / parse failure leave the previous visibility alone.
 * Does not open the panel on cold load or mode switch.
 */
export type BuildFromStepsOutcome = 'success' | 'empty' | 'error';

export function nextShowStepsAfterBuild(
  previous: boolean,
  outcome: BuildFromStepsOutcome,
): boolean {
  if (outcome === 'success') return true;
  return previous;
}


/** Counts nodes (incl. decisions) and role: lines from plainStepsToDSL output. */
export type PlainStepsBuildStats = {
  stepCount: number;
  roles: { human: number; model: number; tool: number; check: number };
};

/**
 * DT-AI-13: derive Build success stats from converter DSL (no parser change).
 * Node lines are steps; decision nodes count. Role tallies omit zeros in the toast.
 */
export function statsFromPlainStepsDsl(dsl: string): PlainStepsBuildStats {
  const stepCount = (dsl.match(/^node\s+\S+/gm) ?? []).length;
  const roles = { human: 0, model: 0, tool: 0, check: 0 };
  for (const m of dsl.matchAll(/^\s*role:\s*(human|model|tool|check)\s*$/gim)) {
    const key = m[1].toLowerCase() as keyof typeof roles;
    roles[key] += 1;
  }
  return { stepCount, roles };
}

const ROLE_DISPLAY: { key: keyof PlainStepsBuildStats['roles']; label: string }[] = [
  { key: 'human', label: 'Human' },
  { key: 'model', label: 'Model' },
  { key: 'tool', label: 'Tool' },
  { key: 'check', label: 'Check' },
];

/**
 * DT-AI-13: one success toast body.
 * e.g. "Built 4 steps onto the board" or
 * "Built 4 steps onto the board · 1 Human · 2 Model · 1 Tool"
 */
export function buildFromStepsSuccessMessage(stats: PlainStepsBuildStats): string {
  const n = stats.stepCount;
  const base = `Built ${n} step${n === 1 ? '' : 's'} onto the board`;
  const parts = ROLE_DISPLAY
    .filter(r => stats.roles[r.key] > 0)
    .map(r => `${stats.roles[r.key]} ${r.label}`);
  return parts.length ? `${base} · ${parts.join(' · ')}` : base;
}
