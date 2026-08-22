# View-only share links

This is the first networked DiagramTool feature. It is **not** multiplayer. The local workspace stays the source of truth. There are no accounts, comments, presence, live sync, or edit-on-link.

## What publish does

**Share → Publish view link** is an explicit button. It POSTs a format **3.0** board JSON snapshot to the share host and returns a tokenized URL:

```
https://diagram-tool.teqcon.uk/view/<token>
```

Anyone with that URL can view the snapshot with no sign-in. The owner’s IndexedDB board is not deleted, migrated, or rewritten. Autosave stays on-device.

## Where snapshots live

Live `diagram-tool.teqcon.uk` is **nginx → Vite preview** on the teqcon.uk VPS (`rsync dist/` + `rsync server/` + systemd). The repo has no wrangler/KV/R2 binding. Cloudflare Workers Builds is a dashboard Git integration (PR previews already fail on earlier branches such as #5; `main` still builds). This feature does **not** rewrite to KV. Ignore Cloudflare Workers Builds.

The store is a **file-backed token store** (`server/sharePlugin.ts`). Production deploy (`deploy-production.yml`) rsyncs `server/` with `--delete` and atomically swaps `dist/`. A store under `dist/` or `server/` dies on every release.

`SHARE_STORE_DIR` is therefore **pinned to a stable absolute path outside `dist/`**. The Node process does **not** guess from `process.cwd()` in production (Vite preview often runs with cwd = `…/dist`).

| Item | Location |
| --- | --- |
| Snapshot + tokens (production default) | **`/var/lib/diagram-tool/share-store/<token>.json`**. Literal absolute path. Not `process.cwd()`, not `$HOME` inference, not inside `dist/`. |
| Live pin | Deploy writes a systemd user drop-in `Environment=SHARE_STORE_DIR=…` and `mkdir`s the directory **before** the `dist` swap. If `/var/lib/diagram-tool/share-store` is not writable by the deploy user, it pins **`$DEPLOY_PATH/share-store`** (sibling of `dist/` and `server/`). Either path survives rsync and the dist swap. |
| Override | `SHARE_STORE_DIR`. Absolute path required on the VPS (deploy sets it). Relative values are local/e2e only. |
| Local / e2e | `.share-store/` in the checkout, or `SHARE_STORE_DIR=.share-store-e2e`. Not used on teqcon.uk. |
| Record | `{ token, manageToken, createdAt, document }` where `document` is format 3.0 board JSON after the presentation sanitizer |
| Public GET | `/api/shares/<token>` returns the sanitized board document only (never `manageToken`) |
| Collection GET | `GET /api/shares` is **404**. There is no list/index of tokens. |
| Viewer page | `/view/<token>` serves the SPA when the token exists; **404** when it does not |

`resolveShareStoreDirectory()` in `server/shareStorePath.ts` implements this. The store is not a static web root (`server.fs.deny` for `.share-store*`).

No user table. The manage token is a capability stored only on the owner’s device (`localStorage` key `diagram-tool.share-links`). Losing that browser means the owner cannot revoke from the UI (v1).

## Token and snapshot rules

- View and manage tokens are 18 CSPRNG bytes, base64url (144 bits). They are not sequential counters.
- Publish (and serve) run the existing presentation sanitizer (`isAllowedPresentationContent` / `sanitizePresentation`). Remote `http(s)` images and `data:image/svg+xml` are dropped. Comments and board-level frames stay empty.
- Revoke/rotate compare the manage token with a constant-time equality check. A viewer never receives it.

## How tokens are revoked and rotated

| Action | Owner UI | Host |
| --- | --- | --- |
| **Revoke** | Share dialog → **Revoke link** | Deletes `<store>/<token>.json` (production: `/var/lib/diagram-tool/share-store`, or the pinned `SHARE_STORE_DIR`). `GET /view/<token>` and `GET /api/shares/<token>` return **404**. |
| **Rotate** | Share dialog → **Replace link** | Writes a new token file in the same durable store, deletes the old one. Old URL 404s; new URL serves the same snapshot. |

Revoke/rotate require the manage token (`X-Share-Manage-Token` or JSON body). A viewer never receives it.

## Viewer rules

The viewer is read-only: no DSL editor, no deck editor, no import, no export-to-overwrite. Download export is allowed. Architecture, sequence, and **Gantt** canvases take `readOnly`. On a published Gantt link there is no task edit, no % complete control, and no schedule drag.

The UI never mentions seats, members, or billing. There is no path that turns a viewer into an identity.
