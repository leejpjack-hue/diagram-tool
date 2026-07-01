# diagram-tool MCP server

Exposes the [`diagram-tool`](https://github.com/leejpjack-hue/diagram-tool) diagram DSL as a set of MCP tools so AI agents (opencode, claude code, Claude Desktop, Cursor, …) can author, edit, verify and export diagrams declaratively.

The server speaks JSON-RPC over stdio and re-uses the existing parser, DSL helpers and template library from the parent project — no DSL implementation is duplicated.

## Tools

| Tool             | Purpose                                                          |
| ---------------- | ---------------------------------------------------------------- |
| `list_templates` | List built-in diagram templates by category                      |
| `load_template`  | Get the DSL for a specific template                              |
| `new_diagram`    | Create a fresh DSL (optionally seeded from a template)           |
| `verify_diagram` | Validate a DSL string and report errors / warnings / summary     |
| `add_node`       | Append a node (service / database / queue / cloud / class / flow / note) |
| `remove_node`    | Delete a node and every reference to it                          |
| `add_edge`       | Connect two nodes (architecture or flow)                         |
| `label_edge`     | Attach a label to a specific connection (REST / dynamic / …)     |
| `set_reverse`    | Flip a flow node's input/output direction (Mermaid-aware)       |
| `get_info`       | Counts and lists for the diagram                                 |
| `export_diagram` | Render to JSON / CSV / Mermaid / Markdown summary                |

## Wiring

### opencode (`~/.config/opencode/opencode.jsonc`)

```jsonc
{
  "mcpServers": {
    "diagram-tool": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/diagram-tool/mcp-server/src/server.ts"]
    }
  }
}
```

### Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "diagram-tool": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/diagram-tool/mcp-server/src/server.ts"]
    }
  }
}
```

Restart the AI client after editing its config.

## Local development

```bash
cd mcp-server
npm install
npm run dev          # tsx watch
npm test             # smoke test the tools via a stdio client
```

The smoke test (`src/server.test.ts`) spawns the server, calls every tool, and prints a short report. It uses no test framework — just Node's `child_process.spawn`.

## DSL reference

The native DSL is documented in the parent project under `src/parser/`. A minimal example:

```
diagram: architecture
title: Request Path
direction: LR

service Client {
  icon: "USR"
  color: "#ec4899"
  connects: CDN
}

cloud CDN {
  color: "#f97316"
  provider: aws
  kind: cloudfront
}

note "REST + cache via CloudFront" {
  color: "#fbbf24"
}

edge Client -> CDN { label: "REST" }
```

Mermaid flowchart syntax is also accepted by the parser and converted transparently:

```
flowchart LR
  A[Start] --> B{Is it valid?}
  B -->|Yes| C[Process]
  B -->|No| D([Reject])
%% reverse D   # flip D's input/output
```
