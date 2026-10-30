# DiagramTool skills workspace

The production Worker (`worker/index.ts`) routes the skills API to the `DiagramSkillsAgent` Durable Object. It is a Think agent backed by a Computer Workspace and exposes `skills.workspace(this.workspace)` from `getSkills()`. The live skills root is `/workspace/.agents/skills/`; it is stored in the Durable Object's SQLite, not the Worker's deployment filesystem. The checked-in `skills/type-to-flow/` is copied into an empty workspace once on first start. The Workspace is authoritative afterward: cold wakes and Worker redeploys do not overwrite operator edits or recreate deleted files. The generated seed is built from those checked-in files by `npm run generate:skills`.

The skill and its deterministic converter descend from the `02-cf-skills` spike (`PROOF.md`, `type-to-flow-skill/`, and `sample/input.json`); the spike Worker was not promoted. DT pins Agents 0.32.0, Think 0.23.0 and Computer 0.8.0 because these APIs are experimental. See Cloudflare's [skills-as-files release](https://developers.cloudflare.com/changelog/post/2026-10-29-agent-skills-from-files/) for the Workspace and next-turn discovery contract.

`GET /api/skills` lists the Workspace catalog; `POST /api/skills/<name>/activate` loads the skill body and resource list through the SDK's catalog activation. `POST /api/skills/type-to-flow/run` activates that skill and runs the statically imported `skills/type-to-flow/scripts/type-to-flow.js` converter (free-plan deploy; no Dynamic Workers / `worker_loaders`). It takes `{ "text": "one step per line", "title": "optional" }`; it returns `{ flow, mermaid, warnings }`. No model or API key is needed for this converter. Decision branches are inferred; review the warnings. In a Flow board, open **Type steps**, enter the workflow, and choose **Run type-to-flow**. This sends the steps to the DT host; do not include secrets. Completed execution records are discarded after the result is read; interrupted runs follow the SDK's retention behavior. The existing **Build board** button remains local. The graph is saved as the board's ordinary native DSL, and the returned Mermaid is shown in the Type steps panel for the result.

## Add or edit a skill without a Worker redeploy

An operator must first provision `SKILLS_ADMIN_TOKEN` as a Worker secret using the platform's secret store. Do not put the token or other secrets in skills, repository files, or shell history. Without this secret, file writes are disabled. The public routes do not expose Think's general chat or Workspace filesystem.

1. Create a folder whose name follows the Agent Skills naming rules, with a `SKILL.md` starting with `name` matching the folder and a nonempty `description`. Keep supporting files under `scripts/`, `references/`, or `assets/`.
2. For each UTF-8 file, write it into the durable Workspace over the authenticated administration endpoint. For example, with `DT_URL` set to the HTTPS Worker origin and `SKILLS_ADMIN_TOKEN` in the environment:

   ```sh
   jq -Rs --arg path 'review-flow/SKILL.md' '{path: $path, content: .}' < ./review-flow/SKILL.md |
     curl --fail-with-body -X PUT "$DT_URL/api/skills/files" \
       -H "Authorization: Bearer $SKILLS_ADMIN_TOKEN" -H 'Content-Type: application/json' --data-binary @-
   ```

   Repeat with paths such as `review-flow/references/guide.md` or `review-flow/scripts/check.js`. The endpoint accepts one file per request, relative to the skills root; it does not accept `..` paths. Upload resources before `SKILL.md` to avoid a partially visible new skill. Only trusted operators may write executable skill files.
3. Check `GET /api/skills`, then `POST /api/skills/review-flow/activate`. The next catalog read and next Think turn see the new or edited files; no reattach or deploy is required. An invalid or missing description is omitted by the SDK catalog.

Each deployed Durable Object has its own workspace. DT uses the fixed `diagram-tool-skills` instance; update the Worker origin serving the intended environment. The current static-server deployment workflow only publishes `dist/`: a static Vite preview cannot host a Durable Object. To use this feature the Worker must serve `/app/` and `/api/skills/*` on the same origin, or the static host must proxy `/api/skills/*` to this Worker. This change does not itself deploy or change the live host.

## Local proof

```sh
npm ci
npm run prove:converter
npm run build
npm test -- --project=unit --maxWorkers=1
npm run prove:skills  # isolated local Worker: catalog, activation, static converter, durable SKILL edits
npm run test:e2e      # includes fixture-injected browser test, no LLM
```

To open the real host locally, run `npm run dev:worker` and visit the `/app/` URL printed by Wrangler. It serves the built app and the skills API together. A Vite-only development server has no skills API.

The e2e fixture injects the spike's expected skill response at the HTTP boundary; `prove:skills` separately exercises the real durable Workspace and the statically imported converter. `npm run test:e2e:preview` runs the skill fixture cases and `/app` smoke against an already-running build; set `PW_BASE_URL` to that build's origin. If port 4173 belongs to another checkout, run the full suite with `PW_PREVIEW_PORT=4183 PW_BASE_URL=http://127.0.0.1:4183 npm run test:e2e -- --workers=1`.

On a slow local host, set `PW_TIMEOUT_SCALE=3` to give the same browser assertions and test workflows more time. The default scale is 1, including CI. `PW_NO_EXTERNAL_FONTS=1` blocks optional external font hosts, and `PW_NO_VIDEO=1` reduces capture overhead.

For an `/app` change, run the live smoke against the deployed preview after deployment: `LIVE_BASE_URL=https://<preview-origin> npm run test:e2e:live`. A run against an older production deployment cannot prove the new feature.
