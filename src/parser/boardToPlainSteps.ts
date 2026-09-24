// Shared board → Type-steps text for Copy as steps (DT-AI-05) and Load steps (DT-AI-07).
// Local only — no network / no LLM.

import { toDslSource } from '../utils/sourceText';
import { parseDiagram } from './parser';
import { flowToPlainSteps } from './flowToPlainSteps';

/** Serialize current editor source (DSL or Mermaid flow) to plain Type steps text. */
export function plainStepsFromBoardSource(dslText: string): string {
  const source = toDslSource(dslText, 'flow');
  const parsed = parseDiagram(source);
  return flowToPlainSteps(parsed);
}

/** Apply serializer output into Type steps panel state (opens panel). */
export function applyLoadedPlainSteps(
  _prevStepsText: string,
  payload: string,
): { stepsText: string; showSteps: true } {
  return { stepsText: payload, showSteps: true };
}
