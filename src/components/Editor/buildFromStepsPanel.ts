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
