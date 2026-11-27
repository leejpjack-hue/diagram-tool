// Shared board → Type-steps text for Copy as steps (DT-AI-05) and Load steps (DT-AI-07).
// Local only — no network / no LLM.

import { toDslSource } from '../utils/sourceText';
import { parseDiagram } from './parser';
import { flowToPlainSteps } from './flowToPlainSteps';
import { diagramMatchesRoleLanes } from './plainSteps';

/**
 * DT-AI-27: Load steps ticks Lanes by role only when the board's lanes are
 * the role lanes. Anything else (no lanes, a custom swimlane) leaves it off.
 */
export function sourceMatchesRoleLanes(dslText: string): boolean {
  try {
    return diagramMatchesRoleLanes(parseDiagram(toDslSource(dslText, 'flow')));
  } catch {
    return false;
  }
}

/** Serialize current editor source (DSL or Mermaid flow) to plain Type steps text. */
export function plainStepsFromBoardSource(dslText: string): string {
  const source = toDslSource(dslText, 'flow');
  const parsed = parseDiagram(source);
  return flowToPlainSteps(parsed);
}

/**
 * DT-AI-09: seeding Type steps when a template is picked. Only the AI workflow
 * template pre-fills Type steps (with the same serializer Load/Copy use);
 * every other template id returns null (no mass auto-seed).
 * Throws for an empty/unsuitable board — the caller shows the teachable toast
 * and leaves the existing Type steps text untouched.
 */
export function seedTypeStepsForTemplate(templateId: string, templateDsl: string): string | null {
  if (templateId !== 'flow-ai-workflow') return null;
  return plainStepsFromBoardSource(templateDsl);
}

/**
 * Opening a skill- or MCP-authored flow board fills Type steps from the source.
 * Other modes and unmarked boards return null so their editors stay as they are.
 * Unreadable source returns null; the caller still opens the text editor.
 */
export function seedTypeStepsForSkillBoard(
  mode: string,
  dslText: string,
  skillAuthored?: boolean,
): string | null {
  if (skillAuthored !== true || mode !== 'flow') return null;
  try {
    const text = plainStepsFromBoardSource(dslText);
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** Apply serializer output into Type steps panel state (opens panel). */
export function applyLoadedPlainSteps(
  _prevStepsText: string,
  payload: string,
): { stepsText: string; showSteps: true } {
  return { stepsText: payload, showSteps: true };
}
