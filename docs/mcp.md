# Local stdio MCP

DiagramTool boards live on this device. This package is a **thin file adapter**: an agent reads and writes the same [portable board JSON](./board-format.md) (version **3.x**, `kind: "board"`) the app already exports. Nothing is uploaded.

There is no remote MCP, no HTTP listener, no OAuth, and no share-link or server snapshot store.

## Install

From a clone of this repo:

```bash
cd mcp
npm install
```

Start with Node / npx (stdio only):

```bash
DIAGRAM_TOOL_DIR=/absolute/path/to/your/boards npx tsx src/server.ts
```

## Folder (`DIAGRAM_TOOL_DIR`)

Point `DIAGRAM_TOOL_DIR` at a folder of **single-board** JSON files:

- Accepted: `version` 3.x and `kind: "board"` (see [board-format.md](./board-format.md))
- Ignored: workspace backups (`kind: "workspace"`), unknown files, nested directories, and older `1.0` / `2.0` documents

Use **File → Open…** / **File → Save** in the app on a file in that folder (the same folder `DIAGRAM_TOOL_DIR` points at), or create one with `create_board`. There is no folder watcher — **File → Reload from disk** re-reads the last handle.

## Connect Cursor

In the app, **File → Connect Cursor** copies an `mcp.json` snippet. Replace the placeholders:

| Placeholder | Meaning |
| --- | --- |
| `/absolute/path/to/diagram-tool/mcp` | This `mcp/` package (after `npm install`) |
| `/absolute/path/to/your/boards` | Your `DIAGRAM_TOOL_DIR` folder |

Paste the snippet into Cursor MCP settings (or `.cursor/mcp.json`). Restart Cursor after editing.

Nothing is uploaded — Cursor talks to a local stdio process that only reads the folder you set as `DIAGRAM_TOOL_DIR`.

```json
{
  "mcpServers": {
    "diagram-tool": {
      "command": "npx",
      "args": ["-y", "tsx", "src/server.ts"],
      "cwd": "/absolute/path/to/diagram-tool/mcp",
      "env": {
        "DIAGRAM_TOOL_DIR": "/absolute/path/to/your/boards"
      }
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_boards` | `filename`, `title`, `mode`, `mtime` for each accepted board file |
| `get_board` | `title`, `mode`, source text, short node/edge summary — no presentation rasters |
| `set_source` | Replace `source.text` / `dslText`. Same parsers as the app. Invalid source → error, file unchanged |
| `create_board` | `title` + `mode` (`architecture` \| `flow` \| `sequence` \| `gantt`) + `source` |

`set_source` and `create_board` write **source only**. They do not hand-edit `nodes` / `edges`. Opening the file in DiagramTool rebuilds the graph through the existing import path.

## Non-goals

- No remote MCP, HTTP listener, OAuth, or VPS copy
- No view-only share links or server-side board store
- No File System Access live-sync
- No comments or multiplayer
- No mutating deck stickies through MCP
- No draw.io import through MCP
