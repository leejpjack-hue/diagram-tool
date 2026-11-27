// Shared board → Type-steps text for Copy as steps (DT-AI-05) and Load steps (DT-AI-07).
// Local only — no network / no LLM.

import { toDslSource } from '../utils/sourceText';
import { parseDiagram } from './parser';
import { flowToPlainSteps } from './flowToPlainSteps';
import { diagramMatchesRoleLanes, plainStepsToDSL } from './plainSteps';

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
  return seedTypeStepsForOpenAsText(mode, dslText);
}

/**
 * Home "Open as text" fills Type steps for any flow board, skill-written or
 * human-typed. Other modes return null; the caller still opens the text editor.
 * Unreadable or empty source returns null.
 */
export function seedTypeStepsForOpenAsText(mode: string, dslText: string): string | null {
  if (mode !== 'flow') return null;
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

/** Empty flow source for a new blank board started by typing. No starter nodes. */
export function blankTypableFlowSource(title = 'Untitled Workflow'): string {
  const name = title.trim() || 'Untitled Workflow';
  return `diagram: flow\ntitle: ${name}\ndirection: LR\n`;
}

/** Title line from flow source, without surrounding quotes. */
export function typedFlowTitle(dslText: string): string {
  const raw = dslText.match(/^\s*title\s*:\s*(.+)\s*$/im)?.[1]?.trim() ?? '';
  return raw.replace(/^["']|["']$/g, '').trim() || 'Untitled Workflow';
}

/**
 * Typed steps are the source for a new blank Home flow.
 * Empty text restores the blank flow. Unreadable text returns null so the
 * canvas stays on the last readable source. Uses the same local converter as
 * Build board — no skill run.
 */
export function flowSourceFromTypedSteps(
  text: string,
  opts: { title?: string; lanesByRole?: boolean } = {},
): string | null {
  const title = opts.title?.trim() || 'Untitled Workflow';
  if (!text.trim()) return blankTypableFlowSource(title);
  try {
    return plainStepsToDSL(text, { title, lanesByRole: opts.lanesByRole });
  } catch {
    return null;
  }
}
