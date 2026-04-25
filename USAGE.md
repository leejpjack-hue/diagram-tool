# DiagramTool — Usage Manual

DiagramTool turns a small text DSL into clean, copy-paste-friendly architecture, flow, and Gantt diagrams. This document is the reference for every keyword, shape, and workflow.

Live: https://diagram.teqcon.uk/

---

## Table of contents

1. [Quick start](#quick-start)
2. [DSL fundamentals](#dsl-fundamentals)
3. [Architecture mode](#architecture-mode)
4. [Flow mode](#flow-mode)
5. [Gantt mode](#gantt-mode)
6. [Edges and labels](#edges-and-labels)
7. [C4 hierarchy & drill-down](#c4-hierarchy--drill-down)
8. [Swimlanes](#swimlanes)
9. [Templates and shortcuts](#templates-and-shortcuts)
10. [Exporting](#exporting)
11. [Troubleshooting](#troubleshooting)

---

## Quick start

1. Open the app, pick a mode tab — **Architecture**, **Flow**, or **Gantt**.
2. Type or paste DSL into the editor on the left.
3. The diagram on the right updates as you type.
4. Click **Templates** to load a working example.
5. Use the floating zoom controls (bottom-left) and minimap (bottom-right) to navigate.

The canvas is white so you can paste rendered diagrams cleanly into Notion, Confluence, Slides, or Word.

---

## DSL fundamentals

```
# Lines starting with `#` are comments
diagram: architecture        # mode: architecture | flow | gantt
title: My System Title       # appears in exports

# A node block — keyword, identifier, then `{ ... }` of properties
service AuthApi {
  type: api
  tech: Node.js
  connects: UserDb            # comma-separated targets allowed
}

database UserDb {
  type: postgresql
  data: users, profiles, roles
}

# Edges (top level — outside any block)
AuthApi -> UserDb
AuthApi ->|reads| UserDb     # `|label|` adds a label to the arrow
```

**Rules of thumb**

- Each property is on its own line: `key: value`.
- Commas separate list values: `connects: A, B, C`.
- Identifiers are case-insensitive when referenced in edges (`AuthApi` and `authapi` both work).
- Multi-word string values are allowed: `tech: Node.js + Express`. They run to end of line.
- Use blank lines freely; whitespace is insignificant outside strings.

---

## Architecture mode

`diagram: architecture` enables five node kinds.

### `service` — generic service / API / microservice

```
service OrdersApi {
  type: api          # api | microservice | lambda
  tech: Spring Boot  # free-form text
  port: 8080
  replicas: 3
  level: container   # see C4 section
  parent: bankingapp # drill-down parent
  connects: OrdersDb
}
```

Visual: rounded rectangle. Blue palette for `api`, purple for everything else. Big ⚡ / ⚙️ icon.

### `database` — relational, document, key-value

```
database OrdersDb {
  type: postgresql   # postgresql | mongodb | mysql | redis
  data: orders, line_items, refunds
}
```

Visual: pink palette, 🗄️ icon. The first 2 entries of `data:` show below the title.

### `queue` — message queue / topic

```
queue Events {
  type: kafka        # kafka | rabbitmq | sqs
  topic: domain.events
}
```

Visual: green palette, 📨 icon.

### `cloud` — provider-managed component

```
cloud Lambda1 {
  provider: aws        # aws | azure | gcp | k8s
  kind: lambda         # see Cloud kinds table
  tech: Python 3.12
  region: us-east-1
  level: container
  parent: someparent
  connects: OrdersDb
}
```

**Provider glyphs** (shown when `kind:` is omitted):

| Provider | Color    | Glyph                              |
|----------|----------|------------------------------------|
| `aws`    | Orange   | Stacked chevrons                   |
| `azure`  | Blue     | Twin peaks                         |
| `gcp`    | Sky blue | Four-color quadrant dots           |
| `k8s`    | Blue     | Heptagon                           |

**Cloud kind icons** (shown instead of provider glyph when `kind:` is set):

| Kind             | Badge | | Kind         | Badge |
|------------------|-------|-|--------------|-------|
| `lambda`         | λ     | | `vm`         | VM    |
| `s3`             | S3    | | `functions`  | ƒ     |
| `rds`            | DB    | | `cosmosdb`   | CX    |
| `ec2`            | EC    | | `blob`       | BL    |
| `dynamodb`       | DY    | | `gce`        | GCE   |
| `sqs`            | Q     | | `cloudfunction` | ƒ  |
| `apigateway`     | API   | | `bigquery`   | BQ    |
| `cloudfront`     | CF    | | `gcs`        | GCS   |
| `pod`            | ⬢     | | `service`    | ⚙     |
| `ingress`        | ↗     | | `configmap`  | ☰     |
| `deployment`     | ⊞     |   |              |       |

### `class` — UML class

```
class Order {
  stereotype: entity
  attributes:
    + id: UUID
    - total: decimal
  methods:
    + addItem(item: Item)
    + checkout(): Receipt
}
```

Visual: white box, three sections (stereotype/title, attributes, methods). Teal palette.

`attributes:` and `methods:` accept bullet-style lines. Use `+` (public), `-` (private), `#` (protected) prefixes by convention.

---

## Flow mode

`diagram: flow` enables flowchart and BPMN shapes.

### Standard flowchart shapes

Each declared with `node` (or `start` / `end` for the special terminators):

```
start Begin
node Validate {
  type: decision
  label: Is data valid?
}
node Process {
  label: Process Order
  system: OrderSvc
  duration: 5m
  assignee: Worker
}
node BadInput {
  type: terminator
  label: Reject
}
end Done

Begin -> Validate
Validate ->|yes| Process
Validate ->|no|  BadInput
Process -> Done
```

`type:` values:

| Type            | Shape                            |
|-----------------|----------------------------------|
| (default)       | Rounded rectangle (process)      |
| `decision`      | Diamond                          |
| `data`          | Parallelogram                    |
| `document`      | Rectangle with wavy bottom edge  |
| `manualinput`   | Trapezoid                        |
| `terminator`    | Pill (neutral grey)              |

### BPMN gateways (diamond + glyph, amber)

| Type                | Glyph | Meaning                  |
|---------------------|-------|--------------------------|
| `gatewayexclusive`  | ✕     | XOR — pick exactly one path |
| `gatewayparallel`   | +     | AND — all paths run       |
| `gatewayinclusive`  | ○     | OR — any subset runs      |

### BPMN events (circle + glyph, green)

| Type           | Style     | Glyph | Meaning            |
|----------------|-----------|-------|--------------------|
| `eventstart`   | thin ring | (none) | Process start     |
| `eventend`     | thick ring| (none) | Process end       |
| `eventtimer`   | thin ring | ⏱     | Time-driven event  |
| `eventmessage` | thin ring | ✉     | Message-driven     |

### BPMN subprocess (rounded rectangle + marker badge, blue)

| Type                    | Marker | Use                          |
|-------------------------|--------|------------------------------|
| `subprocesscollapsed`   | `+`    | Drillable detail (compressed)|
| `subprocessexpanded`    | `−`    | Inline detail (expanded)     |

### Special flow keywords

- `start NodeName` — same as `node NodeName { type: eventstart }` if you don't set a kind.
- `end NodeName` — same as `node NodeName { type: eventend }`.

### Flow node properties

| Property    | Meaning                                            |
|-------------|----------------------------------------------------|
| `type:`     | Shape (see tables above)                           |
| `label:`    | Display text (multi-word allowed)                  |
| `system:`   | System or service responsible (small caption)      |
| `duration:` | e.g. `2m`, `45s`, `1h` (free text)                 |
| `assignee:` | Owner / role                                       |
| `lane:`     | Swimlane id (resolved by `lane` blocks)            |

---

## Gantt mode

`diagram: gantt` activates the Gantt tab. Plans, milestones, and rollups are documented in the Gantt panel; this manual currently focuses on architecture and flow.

---

## Edges and labels

Edges live at the top level (outside `{ }` blocks).

```
A -> B               # plain
A ->|approved| B     # labeled — multi-word allowed inside the pipes
A -> B, C, D         # ❌ not supported — write three lines instead
```

Inside a node block, `connects: B, C, D` is shorthand for three edges from this node to each target.

```
service Foo {
  connects: Bar, Baz
}
# equivalent to:
# Foo -> Bar
# Foo -> Baz
```

---

## C4 hierarchy & drill-down

Architecture nodes can declare a C4 level to power level switching and drill-down.

```
service System1 {
  level: context        # context | container | component | code
}

service WebApp {
  level: container
  parent: system1       # 'parent' is the id of the higher-level node
}
```

**Pill bar** (top-right of canvas in architecture mode) lets you switch which level is shown. Nodes without an explicit `level` are visible on every level (treat them as scaffolding).

**Click-to-drill-down** — click any node that has `parent:`-children below it. The canvas filters to its direct children at the next level. A breadcrumb pill appears (`← All / Parent`) — click `← All` to exit.

---

## Swimlanes

Swimlanes group flow nodes into horizontal bands by actor / role.

```
diagram: flow
title: Loan Application

lane Customer { color: '#FDE68A' }
lane Officer  { color: '#BBF7D0' }
lane Risk     { color: '#FECACA' }
lane System   { color: '#DBEAFE' }

start Apply
node FillForm    { label: Fill Form,    lane: Customer }
node Verify      { label: Verify Docs,  lane: Officer  }
node RiskGateway {
  type: gatewayexclusive
  label: Risk?
  lane: Risk
}
node AutoApprove { label: Auto Approve, lane: System }
node ManualReview{ label: Manual Review,lane: Officer  }
end Done

Apply -> FillForm -> Verify -> RiskGateway
RiskGateway ->|Low Risk| AutoApprove -> Done
RiskGateway ->|High Risk| ManualReview -> Done
```

The diagram lays out each lane as a horizontal band, with the lane name rotated on the left edge.

---

## Templates and shortcuts

Click the **Templates** button (top of the editor panel) for ready-made starting points:

- AWS 3-Tier Web Application
- Kubernetes Microservices
- GCP Data Pipeline
- C4 System Context (Insurance)
- C4 Hierarchical (Levels 1–3)
- ER Diagram
- Network Topology
- UML Class Diagram
- Flow — User Signup
- Flow — Order Processing
- BPMN Events (Loan)
- BPMN Subprocess (Order Fulfillment)
- Swimlane (Loan Application)

### Keyboard shortcuts

| Shortcut          | Action                  |
|-------------------|-------------------------|
| `Ctrl/Cmd + S`    | Save / export current   |
| `Ctrl/Cmd + Z`    | Undo (in editor)        |
| Click node        | Select / drill-down (C4)|
| Drag canvas       | Pan                     |
| Mouse wheel / pinch| Zoom                   |

---

## Exporting

Use the export controls in the toolbar to download the current diagram as PNG, SVG, or PDF. Because the canvas is white, exported images paste cleanly into:

- Confluence / Notion / Google Docs
- Slack / Discord
- PowerPoint / Keynote / Google Slides

Tip: zoom in for higher-resolution PNG exports — output respects the current zoom level.

---

## Troubleshooting

**“Expected IDENTIFIER but got KEYWORD”** — your node name collides with a reserved word. Rename `system`, `data`, `class`, etc., to a non-keyword (`SystemA`, `MainData`, `OrderClass`).

**Multi-word labels are split into separate nodes** — make sure the line begins with `label:` (or another property keyword). Multi-word values are only collected after a recognized property keyword.

**Comma-separated properties on one line don't parse** — each property must be on its own line:

```
# ❌ broken
flow X { type: data, label: My Data }

# ✅ correct
node X {
  type: data
  label: My Data
}
```

**`connects:` only handles outgoing edges** — for inbound edges, write the edge from the source side, or use the top-level `A -> B` form.

**Node disappears after switching C4 levels** — that node has a `level:` set that doesn't match. Either remove `level:` (always-visible scaffolding) or click `All` on the level pill bar.

---

## Reserved keywords

Avoid using these as node names: `diagram`, `title`, `service`, `database`, `queue`, `group`, `contains`, `type`, `tech`, `port`, `replicas`, `data`, `topic`, `connects`, `cloud`, `provider`, `kind`, `region`, `start`, `end`, `node`, `label`, `system`, `duration`, `assignee`, `level`, `parent`, `class`, `attributes`, `methods`, `stereotype`, `lane`, `color`.

If you need one of these as a name, prefix or suffix it: `MainSystem`, `OrderClass`, `EventLane`.
