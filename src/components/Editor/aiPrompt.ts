// DT-AI-17 — one fixed plain-text instruction the user pastes into any chat AI
// (ChatGPT, Claude, Grok, …) so the answer lands in Type steps format and
// Build board just works. No AI is ever called by the app: this is copy-only.
// The worked example at the end (after the "Example" line) must stay parseable
// by plainStepsToDSL — copyAiPrompt.test.tsx round-trips it to keep the two
// in sync. Keep the whole constant ≤ 1200 characters (asserted in tests).
export const AI_PROMPT_TEXT = `Describe a workflow for my flow diagram tool. Reply with ONLY the steps — one step per line, no numbering, no headings, and no text before or after the steps.

Rules:
- One step per line, in order. Use "then" to link steps: Do this, then Do that.
- For a decision, write: If <condition> then <step> else <step>.
- Optionally start a line with a role word: Human:, User:, Model:, Assistant:, AI:, Tool:, Check:, or System:.
- Optionally end a line with a short reason after " — ", like: Do the thing — because it is faster.

Example — reply in exactly this format:
Model: read the support ticket
Draft a reply — reuse the last 3 tickets
then Send the reply
If it bounces then Retry once else Flag for review
Tool: log the outcome`;
