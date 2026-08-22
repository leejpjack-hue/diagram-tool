# DiagramTool portable board format

Version **3.0**. Machine-readable schema: [`board-format.schema.json`](./board-format.schema.json).

This is the public, local-first file format. Exporting SVG, PNG (1×–4×, including 2×), PDF, or JSON does **not** require an account and does **not** add a watermark. A JSON file written by DiagramTool can be re-opened here (or by another tool that implements this schema).

## Documents

Every file has a `version` string. Current writers emit `"3.0"`. Readers must still accept `"1.0"` and `"2.0"` workspace/board files shipped before this document.

### Single board (`kind: "board"`)

```json
{
  "version": "3.0",
  "kind": "board",
  "exportedAt": "2026-08-22T12:00:00.000Z",
  "board": {
    "title": "Payments API",
    "mode": "architecture",
    "source": { "kind": "dsl", "text": "diagram: architecture\nservice Gateway" },
    "dslText": "diagram: architecture\nservice Gateway",
    "nodes": [{ "id": "gateway", "name": "Gateway", "type": "service", "x": 40, "y": 100 }],
    "edges": [],
    "frames": [],
    "comments": [],
    "layout": { "pins": { "gateway": { "x": 40, "y": 100 } } },
    "presentation": { "items": [], "updatedAt": "2026-08-22T12:00:00.000Z" }
  }
}
```

`source.text` is the diagram authoring source (native DSL, or Mermaid for sequence diagrams and Mermaid flowcharts). `dslText` is kept as an alias so older importers keep working.

`nodes` and `edges` are a portable projection of that source plus layout pins. Re-opening the file prefers `source.text` / `dslText` and restores typed boards (architecture, flow, sequence, Gantt) so layout stays within ±2px of the export.

### Complete backup (`kind: "workspace"`)

**Export complete backup** writes one JSON file (`.boards`) that includes:

| Field | Contents |
| --- | --- |
| `boards` | Every local board, including trash |
| `spaces` | Space folders |
| `templates` | Personal templates (not built-in gallery templates) |
| `versions` | Version checkpoint **metadata** (named + automatic), not only the open board |

```json
{
  "version": "3.0",
  "kind": "workspace",
  "exportedAt": "2026-08-22T12:00:00.000Z",
  "boards": [],
  "spaces": [],
  "templates": [],
  "versions": []
}
```

## Reserved fields (format can grow)

| Field | Today | Later |
| --- | --- | --- |
| `board.frames` | Always `[]`. Do not invent board-level frames. | First-class frame containers |
| `board.comments` | Always `[]`. Comments are not a product feature. | Threaded comments |
| Presentation `type: "frame"` | Existing deck/presentation objects; these **do** round-trip | — |

Unknown object types (future nodes, unknown deck types, leftover comments/frames payloads) are **skipped** on import. The import report lists each skipped kind.

## Presentation / deck objects

`board.presentation.items[]` is the existing presentation canvas. Supported `type` values: `image`, `note`, `text`, `arrow`, `shape`, `drawing`, `frame`. Geometry (`x`, `y`, `width`, `height`) is required so a deck re-imports in place.

## Privacy

Export and import of local boards stay on-device. No account is required.
