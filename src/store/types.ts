// Diagram Types

export type DiagramMode = 'architecture' | 'flow' | 'sequence' | 'c4' | 'gantt';

// C4 hierarchical levels — applies to architecture-mode nodes.
// Nodes without an explicit level are visible at every level.
export type C4Level = 'context' | 'container' | 'component' | 'code';

export interface ServiceNode {
  type: 'service';
  id: string;
  name: string;
  properties: {
    type?: 'api' | 'microservice' | 'lambda';
    tech?: string;
    port?: number;
    replicas?: number;
    level?: C4Level;
    parent?: string;
    color?: string; // accent color for presentation-style cards
    icon?: string; // emoji icon for presentation-style cards
  };
  connections: string[];
}

export interface DatabaseNode {
  type: 'database';
  id: string;
  name: string;
  properties: {
    type?: 'postgresql' | 'mongodb' | 'mysql' | 'redis';
    data?: string[];
    color?: string; // accent color override
  };
}

export interface QueueNode {
  type: 'queue';
  id: string;
  name: string;
  properties: {
    type?: 'kafka' | 'rabbitmq' | 'sqs';
    topic?: string;
    color?: string; // accent color override
    icon?: string; // short code/emoji shown in the chip
  };
}

export type FlowNodeKind =
  | 'process'
  | 'decision'
  | 'subprocess'
  | 'external'
  | 'data'
  | 'document'
  | 'manualinput'
  | 'terminator'
  // BPMN gateways
  | 'gatewayexclusive'
  | 'gatewayparallel'
  | 'gatewayinclusive'
  // BPMN events
  | 'eventstart'
  | 'eventend'
  | 'eventtimer'
  | 'eventmessage'
  // BPMN subprocess (collapsed = drillable; expanded = inline)
  | 'subprocesscollapsed'
  | 'subprocessexpanded';

export interface FlowNode {
  type: 'flow';
  id: string;
  name: string;
  properties: {
    label?: string;
    system?: string;
    duration?: string;
    assignee?: string;
    nodeType?: FlowNodeKind;
    lane?: string; // resolved lane id (set during parsing)
    color?: string; // accent override for the shape
    /**
     * Flip the input/output handles — useful in LR layouts where a "return"
     * path would otherwise double back and overlap the incoming edge. Set
     * via `reverse: true` in the DSL or by double-clicking the node.
     */
    reversed?: boolean;
  };
  isStart?: boolean;
  isEnd?: boolean;
}

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'k8s';

export interface CloudNode {
  type: 'cloud';
  id: string;
  name: string;
  properties: {
    provider?: CloudProvider;
    kind?: string; // e.g. 'lambda', 'rds', 'vm', 'pod'
    tech?: string;
    region?: string;
    level?: C4Level;
    parent?: string;
    color?: string; // accent color override
    icon?: string; // short code/emoji shown in the chip
  };
  connections: string[];
}

// UML class node: title bar, attributes, methods.
export interface ClassNode {
  type: 'class';
  id: string;
  name: string;
  properties: {
    stereotype?: string; // e.g. <<interface>>, <<abstract>>
    attributes?: string[];
    methods?: string[];
    level?: C4Level;
    parent?: string;
    color?: string; // accent color override
  };
  connections: string[];
}

// Annotation node — sticky-note callout that floats over the canvas to call
// out a risk, a decision, or a piece of extra context. It carries no edges and
// isn't part of the autolayout graph; users position it with x:/y: in the DSL
// or by dragging on the canvas.
export interface AnnotationNode {
  type: 'annotation';
  id: string;
  name: string; // short label shown in the property panel / a11y
  properties: {
    text: string; // body of the sticky note
    color?: string; // accent colour override (defaults to amber)
    x?: number; // optional initial x position (overrides autolayout)
    y?: number;
  };
}

export type DiagramNode = ServiceNode | DatabaseNode | QueueNode | CloudNode | ClassNode | FlowNode | AnnotationNode;

// Swimlane: a horizontal band that visually groups flow nodes by actor/role.
export interface Lane {
  id: string;
  name: string;
  contains: string[]; // flow node ids
  color?: string;
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface Group {
  id: string;
  name: string;
  contains: string[];
  label?: string; // optional display label; defaults to `name`
  color?: string; // optional dashed-border color; defaults to slate
  // Pinned geometry from `at:`/`size:` — when present the container is drawn
  // at these coords instead of being computed from member positions.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

// Connecting-line style for architecture/flow edges.
//   curved      = smooth bezier  (React Flow 'default')
//   orthogonal  = rounded 90°    (React Flow 'smoothstep')
//   step        = sharp 90°      (React Flow 'step')
//   straight    = straight line  (React Flow 'straight')
export type EdgeStyle = 'curved' | 'orthogonal' | 'step' | 'straight';

// Layout flow direction: 'TB' (top → bottom, default) or 'LR' (left → right).
// Set in DSL with `direction: vertical | horizontal` (or the aliases tb / lr).
export type LayoutDirection = 'TB' | 'LR';

export interface ParsedDiagram {
  mode: DiagramMode;
  title: string;
  nodes: DiagramNode[];
  edges: Edge[];
  groups: Group[];
  lanes?: Lane[];
  startNode?: string;
  endNode?: string;
  direction?: LayoutDirection;
  edgeStyle?: EdgeStyle;
  // Pinned node positions from `at: x, y`, keyed by node id. Honoured by the
  // renderer in place of auto-layout for those nodes.
  pins?: Record<string, { x: number; y: number }>;
}

// Clipboard types for copy/paste
export interface ClipboardNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}
