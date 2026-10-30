# DT-SKILL-01, DT-SKILL-02, DT-SKILL-03

Base SHA: `2429be22` (`2429be22a3a3459060495cf7654724b739a67656`).
Branch: `feat/dt-skill-01-03-skills-as-files`.

The prior interrupted run's changes were retained and reviewed. This branch
adds the production DT Think agent with a durable skills Workspace at
`/workspace/.agents/skills/`, SDK catalog/activation, authenticated file updates
without redeploy, and a pinned JavaScript execution backend. The production
`type-to-flow` skill emits typed flow JSON and `flowchart TD` Mermaid. Its graph
adapter uses DT's existing flow nodes, decision nodes, terminators, edges, and
native DSL persistence. **Type steps → Run type-to-flow** builds the board and
shows the returned Mermaid and decision warnings.
Native source preserves the converter's node order, keeping the end after the
intermediate steps in DT's stack layout.
The editor scrolls vertically so the Mermaid remains reachable beneath a long
workflow preview; Playwright verifies this with ordinary wheel scrolling.

Regression support removes automatic DOM thumbnail cloning during editing;
thumbnails are still captured on explicit save and returning to Boards. Profiling
showed the background clone blocking the Flow canvas. The autosave reload test
now holds the browser clock, so its before-debounce proof is deterministic.
`PW_TIMEOUT_SCALE` gives slower local hosts more time without changing CI defaults.

DT-SKILL-04 through DT-SKILL-10 are outside this change. No remote push or
deployment is part of this delivery. No production secrets are added to the tree.

## Files changed

```text
.github/workflows/e2e.yml
.gitignore
DONE.md
README.md
docs/skills-workspace.md
e2e/architecture-icon-style.spec.ts
e2e/architecture-request-path.spec.ts
e2e/architecture-type-parts.spec.ts
e2e/autosave-reload.spec.ts
e2e/board-file.spec.ts
e2e/board-size-meter.spec.ts
e2e/export-portable.spec.ts
e2e/flow-edge-handles.spec.ts
e2e/gantt-duration-after.spec.ts
e2e/gantt-mermaid-paste.spec.ts
e2e/gantt-mmd-dashboard-import.spec.ts
e2e/gantt-source-sync.spec.ts
e2e/gantt-type-tasks.spec.ts
e2e/gantt-working-days.spec.ts
e2e/icon-style.spec.ts
e2e/import-drawio.spec.ts
e2e/landing.spec.ts
e2e/presentation-connectors.spec.ts
e2e/presentation-frames.spec.ts
e2e/sequence-box-create-destroy.spec.ts
e2e/sequence-mermaid-fidelity.spec.ts
e2e/sequence-roles-style.spec.ts
e2e/sequence-type-messages.spec.ts
e2e/sequence-walkthrough.spec.ts
e2e/source-sync.spec.ts
e2e/step-numbers.spec.ts
e2e/testTimeout.ts
e2e/type-steps-ai-prompt.spec.ts
e2e/type-steps-data.spec.ts
e2e/type-steps-lanes.spec.ts
e2e/type-steps-loop.spec.ts
e2e/type-steps-parallel.spec.ts
e2e/type-steps-preview.spec.ts
e2e/type-steps-walkthrough.spec.ts
e2e/type-to-flow-skill.spec.ts
e2e/workshop-starters.spec.ts
e2e/workspace-persistence.spec.ts
e2e/workspace-title-fit.spec.ts
fixtures/type-to-flow/input.json
fixtures/type-to-flow/spike-output.json
package-lock.json
package.json
playwright.config.ts
playwright.live.config.ts
playwright.preview.config.ts
scripts/generate-skill-seed.mjs
scripts/prove-converter.mjs
scripts/prove-skills.mjs
skills/type-to-flow/SKILL.md
skills/type-to-flow/references/flow-schema.md
skills/type-to-flow/scripts/type-to-flow.js
src/App.tsx
src/components/Editor/DSLEditor.tsx
src/components/Workspace/BoardSizeMeter.tsx
src/parser/lexer.ts
src/styles/professional.css
src/utils/typeToFlow.test.ts
src/utils/typeToFlow.ts
tsconfig.node.json
tsconfig.worker.json
worker/index.ts
worker/skills-agent.ts
wrangler.jsonc
```

`worker/generated-skill-seed.ts` is generated and ignored. It bootstraps an
empty durable Workspace once; operator files become authoritative afterward.
The two fixture files exactly match the spike's sample input and output.

## How to prove

Use Node 22 or later:

```sh
npm ci
npm run prove:converter
npm run build
npm test -- --project=unit --maxWorkers=1
npm run prove:skills
npx playwright install --with-deps chromium
npm run test:e2e -- --workers=1
```

`prove:skills` uses an isolated, temporary local Worker and storage. It checks
the actual Workspace catalog, activation body, JavaScript execution, denied
unauthenticated writes, authenticated skill discovery and body edits, converter
script edits without redeploy, and persistence after restarting the Worker.
It does not call an LLM or require Cloudflare credentials.

If port 4173 is already occupied by another checkout, use:

```sh
PW_PREVIEW_PORT=4183 PW_BASE_URL=http://127.0.0.1:4183 \
  PW_TIMEOUT_SCALE=3 PW_NO_EXTERNAL_FONTS=1 PW_NO_VIDEO=1 \
  npm run test:e2e -- --workers=1
```

The fixture-injected skill e2e checks seven nodes (one start, four steps, one
decision, one end), seven edges, Mermaid display, saved-board reopening, and
preservation of the board after failed, malformed, or stale results.

For a manual check of this build with the real host, run `npm run dev:worker`,
open `/app/` on its printed origin, create a Blank Workflow, open **Type steps**,
paste the text from `fixtures/type-to-flow/input.json`, and choose
**Run type-to-flow**. See [skills-workspace.md](docs/skills-workspace.md) for
authenticated add-skill instructions and deployment routing requirements.

## Validation results

- Production build and Worker typecheck: passed.
- Converter fixture parity and decision branch proof: `PROOF_OK=1`.
- Actual Worker catalog, activation, execution, authenticated file and script
  edits without redeploy, and persistence after a process restart: `PROOF_OK=1`.
- Real local DT Worker `/app/` smoke with no injected API response: `PROOF_OK=1`;
  catalog, activation, Workspace conversion, ordered seven-node graph, Mermaid
  visible after wheel scrolling, and saved-board reload all passed. No LLM.
- New Playwright skill fixture suite against this checkout's production preview:
  **4 passed** (2.1 minutes), including wheel-scrolling the Mermaid into view,
  with no LLM.
- Unit suite: 675 passed and one five-second timeout in the existing presentation
  canvas file; the affected file subsequently passed **8/8** with
  `--testTimeout=60000`. The new adapter tests passed in the full unit run.
- The order-sensitive adapter round-trip and validation tests were rerun after
  preserving node order: **2 passed** (6.5 seconds).
- Default Flow switching regression after removing background thumbnail capture:
  **1 passed** (39.5 seconds).
- Deterministic before-autosave reload regression: **1 passed** (59.0 seconds).
- Existing live deployment smoke at `https://diagram-tool.teqcon.uk`: **3 passed**
  (51.3 seconds), including dashboard desktop/mobile and `/app` reload without
  React #185, using `PW_TIMEOUT_SCALE=5 PW_NO_VIDEO=1 npm run test:e2e:live`.
  The default five-second cold-Monaco assertion initially timed out; it passed
  with the expanded local budget. This is a baseline smoke, not deployment of
  this branch's new feature.
- Full Playwright regression and live smoke results are being recorded in a
  follow-up validation commit. Earlier broad runs exposed the thumbnail stall
  and a wall-clock autosave assertion, which are addressed above.

The existing production delivery workflow uploads static `dist/` assets. The
skills API requires the DT Worker on the same origin or a proxy to it. A deploy
and subsequent smoke of the new feature on that deployed origin remain release
steps; an existing live deployment cannot prove an unpushed branch's feature.
