---
name: type-to-flow
description: Convert a plain-text workflow into a typed flow and Mermaid flowchart for DiagramTool. Use for process steps, workflow outlines, and flowcharts from prose.
metadata:
  provenance: cf-skills-type-to-flow-spike
  version: "1.0.0"
---

# type-to-flow

Convert one workflow step per line into the typed flow envelope consumed by DiagramTool.

1. Read `references/flow-schema.md` with `read_skill_resource` using this skill's name and the relative path.
2. Run the Workspace `exec` tool with backend `js`, `cwd` set to the skill's activation `location`, and this code:

   ```js
   export { default } from "./scripts/type-to-flow.js";
   ```

   Pass `{ "text": "<workflow, one step per line>", "title": "<optional title>" }` as `input`.
3. Return the complete result: `flow`, `mermaid`, and `warnings`. Tell the user that inferred decision branches should be checked.

The converter recognizes questions and lines starting with if, when, or whether as decisions. It assumes a yes path to the next step and a no path to the end. These are heuristics, not facts established by the prose. Do not invent additional workflow details. Empty input is an error.
