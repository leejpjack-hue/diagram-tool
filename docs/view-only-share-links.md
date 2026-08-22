# View-only share links

This is the first networked DiagramTool feature. It is **not** multiplayer. The local workspace stays the source of truth. There are no accounts, comments, presence, live sync, or edit-on-link.

## What publish does

**Share → Publish view link** is an explicit button. It POSTs a format **3.0** board JSON snapshot to the share host and returns a tokenized URL:

```
https://diagram-tool.teqcon.uk/view/<token>
```

Anyone with that URL can view the snapshot with no sign-in. The owner’s IndexedDB board is not deleted, migrated, or rewritten. Autosave stays on-device.

## Where snapshots live

Live `diagram-tool.teqcon.uk` is **nginx → Vite preview** on the teqcon.uk VPS (`rsync dist/` + systemd). There is no Cloudflare Worker, KV, or R2 binding today.

The smallest store that fits that host is a **file-backed token store** attached to the same Vite dev/preview process (`server/sharePlugin.ts`):

| Item | Location |
| --- | --- |
| Snapshot + tokens | `.share-store/<token>.json` next to the Vite process (`SHARE_STORE_DIR` overrides) |
| Record | `{ token, manageToken, createdAt, document }` where `document` is format 3.0 board JSON |
| Public GET | `/api/shares/<token>` returns the board document only (never `manageToken`) |
| Viewer page | `/view/<token>` serves the SPA when the token exists; **404** when it does not |

No user table. The manage token is a capability stored only on the owner’s device (`localStorage` key `diagram-tool.share-links`). Losing that browser means the owner cannot revoke from the UI (v1).

## How tokens are revoked and rotated

| Action | Owner UI | Host |
| --- | --- | --- |
| **Revoke** | Share dialog → **Revoke link** | Deletes `.share-store/<token>.json`. `GET /view/<token>` and `GET /api/shares/<token>` return **404**. |
| **Rotate** | Share dialog → **Replace link** | Writes a new token file, deletes the old one. Old URL 404s; new URL serves the same snapshot. |

Revoke/rotate require the manage token (`X-Share-Manage-Token` or JSON body). A viewer never receives it.

## Viewer rules

The viewer is read-only: no DSL editor, no deck editor, no import, no export-to-overwrite. Download export is allowed. The UI never mentions seats, members, or billing. There is no path that turns a viewer into an identity.
