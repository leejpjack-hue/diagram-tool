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

### Flow icon style

`board.iconStyle` is optional and additive. `version` stays **3.0**. No database migration.

| Value | Meaning |
| --- | --- |
| `clean` | Default. Today's Flow look. Writers may omit the field. |
| `line` | Line icons |
| `bold` | Bold filled |
| `blueprint` | Blueprint |

Missing or unknown values load as `clean`. Older readers ignore the field. A diagram that omits `iconStyle` still loads as `clean`.

### Step numbers

`board.showStepNumbers` is optional and additive. `version` stays **3.0**. No database migration.

| Value | Meaning |
| --- | --- |
| omitted / `false` | Default. Step numbers are off. Writers omit the field. |
| `true` | Flow nodes show a badge in Walk through order. |

Missing or non-boolean values load as off. Older readers ignore the field. A diagram saved before this field — no `showStepNumbers` and no `iconStyle` — still loads with step numbers off and Clean style. Saving that board while both settings are at their defaults omits both fields.

### Typed data steps

Type steps may emit the existing flow kinds `type: data` (`Data:`, `Memory:`, `DB:`) and `type: document` (`File:`) inside `source.text` / `dslText`. These kinds already exist. They are not a new board field. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Typed loop steps

Type steps may point at an earlier step with `go back to`, `back to`, `repeat from`, or `retry from`. The board stores that link as an ordinary edge inside `source.text` / `dslText`. The edge label is `loop`, or `Yes` / `No` when the link is a branch. This is not a new board field. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Typed parallel steps

Type steps may split one line with `and at the same time`, `in parallel with`, or `meanwhile`. The board stores that fan-out as the existing `type: gatewayparallel` fork, the branch nodes, and — when another step follows — a `type: gatewayparallel` join, inside `source.text` / `dslText`. These kinds already exist. They are not a new board field. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Role lanes from Type steps

Type steps may place steps in the existing swimlane `lane` blocks Human, AI agent, Tool, Check, Data, and Other. Only lanes that contain steps are written. These blocks live inside `source.text` / `dslText`. They are not a new board field. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Understood as preview

Type steps shows a live, read-only "Understood as" list while the user types. It uses the same local converter as Build board and is not written into `source.text`, `dslText`, or any other board field. The board changes only when the user presses Build board. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Flow connection sides

A Flow arrow in `source.text` / `dslText` may name the sides it uses:

```
Alpha -> Beta { from: right, to: left }
```

`from` and `to` are the existing connection sides: `top`, `right`, `bottom`, or `left`. They are optional. When a side is missing, the board attaches that end to the side that keeps the orthogonal path short: a neighbour to the left or right uses left/right, a neighbour above or below uses top/bottom. Dragging a handle writes the sides onto that arrow. Older arrows with no sides keep the same nodes and edges and re-attach from their positions. This is not a new board field. `version` stays **3.0**. No database migration.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Gantt duration and predecessors

`duration:` and `after:` are task keys inside `source.text` / `dslText` for `diagram: gantt`. They are not a new board field. `version` stays **3.0**. No database migration. A board that only uses `start:` and `end:` still loads as it does today.

| Key | Meaning |
| --- | --- |
| `duration: 5d` | The bar is 5 calendar days long. `d` is a day. |
| `duration: 2w` | The bar is 2 weeks long. A week is 7 days. |
| `after: Design` | Start the day after Design ends, and draw a finish-to-start dependency. |
| `after: Design, Research` | Start the day after the later predecessor ends. Each name adds a finish-to-start dependency. |

What wins when several keys are present:

- An explicit `start:` beats `after:`.
- An explicit `end:` beats `duration:`.
- A task with no `start:` and no `after:` starts on the project `start:`.
- `milestone: true` with `after:` sits on the day the predecessor ends.

Dragging a bar that has `after:` writes an explicit `start:` into the source. That start wins over `after:` for the date, and the dependency remains. Resizing a bar writes `duration:` (and drops `end:` when the length is now a duration). A cycle names the tasks in the parse error and leaves the last good chart on screen. An unknown `after:` name warns with the line number and still draws the rest of the plan.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

### Sequence arrows, activation, and autonumber

Sequence boards keep these Mermaid keywords inside `source.text` / `dslText`. They are not a new board field. `version` stays **3.0**. No database migration. A diagram that does not use them draws the same arrows it does today.

| Source | Meaning |
| --- | --- |
| `A->>B` / `A-->>B` | Solid or dashed call with a filled arrowhead. |
| `A->B` / `A-->B` | Solid or dashed line with no arrowhead. |
| `A-)B` / `A--)B` | Solid or dashed async message with an open arrowhead. |
| `A-xB` / `A--xB` | Solid or dashed lost or failed message with a cross. |
| `+` on an arrow | Activates the receiver. A narrow bar starts on that lifeline. |
| `-` on an arrow | Deactivates the sender. The newest bar on that lifeline ends. |
| `activate X` / `deactivate X` | Start or end an activation bar on X. |
| `autonumber` | Number each message from 1, stepping by 1. |
| `autonumber 10` | Start at 10, step 1. |
| `autonumber 10 5` | Start at 10, step 5. |

A bar runs from the activating row to the deactivating row. Stacked activations of one participant are offset. An activation that never closes runs to the last row. A `deactivate` with nothing active is ignored. Boards that omit these keywords render as they do today.

A diagram that omits `iconStyle` still loads as `clean`. A diagram that omits `showStepNumbers` still loads with step numbers off.

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

`board.presentation.items[]` is the existing presentation canvas. Supported `type` values: `image`, `note`, `text`, `arrow`, `shape`, `drawing`, `frame`. Geometry (`x`, `y`, `width`, `height`) is required so a deck re-imports in place. Deck frames (`type: "frame"`) use `title`, `style.strokeColor` for color, `lockChildren`, and `hidden` (hidden frames are skipped by Present and excluded from PNG/PDF export). Do not put frames in `board.frames`.

Deck arrows (`type: "arrow"`) may optionally bind to another deck object so they reflow when that object moves or resizes:

| Field | Meaning |
| --- | --- |
| `startId` / `endId` | Id of the attached shape, sticky (`note`), text, or frame. Omit for a free-floating end. |
| `startSide` / `endSide` | Magnet on that object: `left`, `right`, `top`, or `bottom`. |
| `content` | JSON `{ start, end, label? }` in the arrow's local box. `label` is an optional edge caption that stays on the connector. Older arrows with no bindings (or a color string as `content`) still import. |

## Privacy

Export and import of local boards stay on-device. No account is required.
