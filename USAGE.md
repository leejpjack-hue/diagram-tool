# DiagramTool — Usage Manual

DiagramTool turns a small text DSL into clean, copy-paste-friendly architecture, flow, and Gantt diagrams. This document is the reference for every keyword, shape, and workflow.

Live: https://diagram.teqcon.uk/

---

## Table of contents

1. [Quick start](#quick-start)
2. [DSL fundamentals](#dsl-fundamentals)
3. [Layout direction](#layout-direction)
4. [Connector style](#connector-style)
5. [Architecture mode](#architecture-mode)
6. [Sub-system grouping](#sub-system-grouping)
7. [Flow mode](#flow-mode)
8. [Gantt mode](#gantt-mode)
9. [Edges and labels](#edges-and-labels)
10. [C4 hierarchy & drill-down](#c4-hierarchy--drill-down)
11. [Swimlanes](#swimlanes)
12. [Templates and shortcuts](#templates-and-shortcuts)
13. [Exporting](#exporting)
14. [Custom icons](#custom-icons)
15. [Troubleshooting](#troubleshooting)

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
direction: horizontal        # vertical (default) | horizontal — see Layout direction
edges: orthogonal            # curved (default) | orthogonal | step | straight — see Connector style

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

## Layout direction

Architecture and flow diagrams default to a **vertical** layout — sources at the top, edges flowing top → bottom. Set `direction: horizontal` (top level, anywhere before the first node) to flip the entire diagram to flow **left → right** instead. Source/target handles automatically move from the top/bottom edges to the left/right edges, so edges curve correctly.

```
diagram: architecture
direction: horizontal
title: Order System

service Web   { type: api  connects: OrdersApi }
service OrdersApi { type: api  connects: OrdersDb }
database OrdersDb { type: postgresql }
```

Renders Web → OrdersApi → OrdersDb across the canvas instead of stacked downward.

**Accepted values** (case-insensitive, dashes/underscores ignored):

| You write… | Interpreted as | Result |
|---|---|---|
| `direction: vertical` *(default)* | TB | Top → Bottom (default) |
| `direction: tb` / `top-bottom` | TB | Top → Bottom |
| `direction: horizontal` | LR | Left → Right |
| `direction: lr` / `left-right` | LR | Left → Right |

Anything unrecognised falls back to vertical so a typo can't break rendering.

**Notes**
- The keyword applies to **architecture** and **flow** diagrams. Gantt mode is unaffected (it has its own time-axis layout).
- **Swimlanes** always lay out horizontally within each lane regardless of `direction:` — that's intrinsic to the swimlane shape.
- Flow templates with **decision gateways** keep their secondary branch handles on the perpendicular sides (top/bottom in LR mode, left/right in TB mode), so you can route `yes`/`no` paths to either side.

---

## Connector style

By default edges between architecture components are drawn as **smooth curves** (bezier). Use the top-level `edges:` keyword to switch to right-angle or straight connectors instead — useful when you want the diagram to read like a network/infrastructure schematic rather than a free-form sketch.

```
diagram: architecture
edges: orthogonal     # 90° corners with rounded bends
```

| You write…                                       | Renders as                                  |
|--------------------------------------------------|---------------------------------------------|
| `edges: curved` *(default)* / `bezier`           | Smooth bezier curves                        |
| `edges: orthogonal` / `smoothstep` / `rounded`   | 90° right-angle corners (rounded)           |
| `edges: step` / `sharp` / `right-angle`          | 90° right-angle corners (sharp)             |
| `edges: straight` / `line` / `direct`            | Straight point-to-point lines               |

The keyword applies to architecture diagrams only. Flow-mode connectors keep their animated bezier style — orthogonal corners pair badly with the dashed pulse animation. Pair `edges: orthogonal` with `direction: horizontal` for the cleanest cloud-architecture look.

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

Visual: rounded rectangle. Blue palette for `api`, purple for everything else. The 44×44 badge shows a custom SVG glyph (lightning bolt for `api`, gear for service) — see [Custom icons](#custom-icons).

### `database` — relational, document, key-value

```
database OrdersDb {
  type: postgresql   # postgresql | mongodb | mysql | redis
  data: orders, line_items, refunds
}
```

Visual: pink palette, custom database cylinder SVG. The first 2 entries of `data:` show below the title.

### `queue` — message queue / topic

```
queue Events {
  type: kafka        # kafka | rabbitmq | sqs
  topic: domain.events
}
```

Visual: green palette, custom envelope/queue SVG.

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

**Cloud kind icons** (shown instead of provider glyph when `kind:` is set). Every kind below is a hand-drawn SVG file under `src/components/Canvas/icons/kinds/`. Icons are monochrome `currentColor` line-art so they stay legible on any provider pill (AWS orange, Azure blue, GCP cyan, K8s blue).

| Category | Kinds | Glyph |
|----------|-------|-------|
| **K8s**       | `pod`                                    | hexagon with center dot         |
|               | `cluster`                                | heptagon with mesh nodes        |
|               | `service`                                | gear / cog                      |
|               | `ingress`                                | arrow entering box              |
|               | `configmap`                              | document with lines             |
|               | `deployment`                             | three offset rectangles         |
| **Compute**   | `lambda`                                 | lightning bolt (filled)         |
|               | `function`, `functions`, `cloudfunction` | scripted ƒ                      |
|               | `ec2`, `vm`, `gce`                       | server / chip                   |
| **Storage**   | `s3`, `blob`, `gcs`                      | bucket                          |
|               | `rds`, `dynamodb`                        | three-tier cylinder             |
|               | `mongodb`, `mongo`                       | leaf                            |
|               | `postgresql`, `postgres`                 | cylinder with face              |
|               | `cosmosdb`                               | three-axis sphere               |
|               | `bigquery`                               | analytics dial + magnifier      |
| **Network**   | `apigateway`                             | doorway with arrow              |
|               | `loadbalancer`, `lb`                     | distribution node fan-out       |
|               | `cdn`, `cloudfront`                      | globe with meridian             |
|               | `nginx`                                  | bold N polyline                 |
| **Security**  | `firewall`                               | shield with brick pattern       |
|               | `waf`                                    | shield with globe + lock        |
| **Cache/Queue** | `cache`, `redis`                       | two-tier cylinder               |
|               | `sqs`                                    | envelope                        |

Any AWS / Azure / GCP / K8s kind not in the table above will fall back to a 1–3 letter unicode tag (`DY` for DynamoDB, `BL` for Blob, `BQ` for BigQuery, etc.) until an SVG is supplied for it.

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

## Sub-system grouping

Real architectures have sub-systems — a compute tier, a data tier, an analytics pillar, an external-vendor cluster. Use the `group` block to draw a **dashed-line container** around any set of components. The container is auto-sized from its members' positions and labelled at the top-left.

```
diagram: architecture
title: Order System
edges: orthogonal

cloud Web      { provider: aws  kind: cloudfront  connects: ApiGw }
cloud ApiGw    { provider: aws  kind: apigateway connects: AuthFn, OrdersFn }
cloud AuthFn   { provider: aws  kind: lambda  connects: UserDb }
cloud OrdersFn { provider: aws  kind: lambda  connects: OrdersDb, EventBus }
database UserDb   { type: postgresql }
database OrdersDb { type: postgresql }
queue    EventBus { type: sqs }

group ComputeTier {
  label: Compute Tier
  color: #3B82F6
  contains: AuthFn, OrdersFn
}

group DataTier {
  label: Data Tier
  color: #EC4899
  contains: UserDb, OrdersDb, EventBus
}
```

**Block properties**

| Property    | Required | Default                     | Notes                                                |
|-------------|----------|-----------------------------|------------------------------------------------------|
| `contains:` | yes      | —                           | Comma-separated list of node identifiers to wrap.    |
| `label:`    | no       | the group's name            | Multi-word string allowed.                           |
| `color:`    | no       | slate (`#64748B`)           | Any 6-digit `#RRGGBB`. Drives both border and tint.  |

**Notes**

- Groups paint a dashed rectangle behind their members with a soft tint. Auto-layout is group-aware: after placing nodes, a post-pass detects pairs of group rectangles that would overlap and shifts one group's members along the perpendicular-to-flow axis until the rectangles are separated. Two groups never visually overlap each other unless their members do.
- **Group containers are draggable.** Grab the dashed rectangle and drag — every contained node travels with it, so you can rearrange whole sub-systems after auto-layout if you want a different presentation. Member nodes are still individually draggable on top.
- A node may appear in multiple groups; they'll each draw their own outline.
- Members that are filtered out by `level:` or drill-down are quietly skipped — empty groups don't render.

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

## Custom icons

Every glyph rendered on a node badge — provider logo, cloud kind, database, queue, service — is a standalone `.svg` file under `src/components/Canvas/icons/`. Drop a new SVG into the right folder and it auto-loads via Vite's `import.meta.glob`. **No code change is required** to add or replace an icon.

### Folder layout

```
src/components/Canvas/icons/
├── index.tsx              # registry + <ProviderIcon/>, <KindIcon/>, <NodeIcon/>
├── providers/             # cloud-provider badge glyphs
│   ├── aws.svg            # provider: aws  →  filename = DSL value
│   ├── azure.svg
│   ├── gcp.svg
│   └── k8s.svg
├── kinds/                 # cloud kind: glyphs (lambda, s3, pod, …)
│   └── *.svg
└── nodes/                 # built-in node-type glyphs
    ├── api.svg            # ServiceNode when type: api
    ├── service.svg        # ServiceNode default
    ├── database.svg       # DatabaseNode
    └── queue.svg          # QueueNode
```

### Lookup priority

| Node       | Resolution order                                                       |
|------------|------------------------------------------------------------------------|
| **Cloud**  | `kinds/<kind>.svg` → unicode tag (`DY`, `BL`, …) → `providers/<provider>.svg` |
| **Service**| `nodes/api.svg` or `nodes/service.svg` → `⚡` / `⚙️` emoji fallback    |
| **Database**| `nodes/database.svg` → `🗄️` emoji fallback                            |
| **Queue**  | `nodes/queue.svg` → `📨` emoji fallback                                |

So the system gracefully falls back if a custom SVG is missing.

### Authoring rules for designers

1. **Format:** SVG only. Filename (lower-case, no spaces) becomes the lookup key. `kinds/lambda.svg` → matches DSL `kind: lambda`.
2. **ViewBox:** `<svg viewBox="0 0 16 16">` or `<svg viewBox="0 0 24 24">` — keep it square. Set `width="100%" height="100%"` on the root, no fixed pixel dimensions.
3. **Color strategy:**
   - For monochrome shapes use `fill="currentColor"` and/or `stroke="currentColor"`. The parent badge controls the tint (white on a colored pill, etc.).
   - Multi-color icons (like GCP four dots) may hardcode hex. Keep contrast in mind — they will be rendered on colored 44×44 badges.
4. **Inner padding:** leave ~10% margin so the glyph never touches the badge edge.
5. **No text inside the SVG** — no `<title>`, `<desc>`, or text labels. Labels are rendered separately by the node component.

### Adding a brand-new kind

```bash
# 1. Drop the file
cp my-redshift.svg src/components/Canvas/icons/kinds/redshift.svg

# 2. Use it in DSL
cloud Reports {
  provider: aws
  kind: redshift
}
```

That's it — no registration step. The glob picks the file up on the next dev-server reload.

### Replacing an existing icon

Same as above: overwrite the file. The new design ships on the next build. Keep `currentColor` if you want the icon to keep inheriting the badge color.

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

Avoid using these as node names: `diagram`, `title`, `direction`, `edges`, `service`, `database`, `queue`, `group`, `contains`, `type`, `tech`, `port`, `replicas`, `data`, `topic`, `connects`, `cloud`, `provider`, `kind`, `region`, `start`, `end`, `node`, `label`, `system`, `duration`, `assignee`, `level`, `parent`, `class`, `attributes`, `methods`, `stereotype`, `lane`, `color`.

If you need one of these as a name, prefix or suffix it: `MainSystem`, `OrderClass`, `EventLane`.
