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
  };
}

export interface QueueNode {
  type: 'queue';
  id: string;
  name: string;
  properties: {
    type?: 'kafka' | 'rabbitmq' | 'sqs';
    topic?: string;
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
  };
  connections: string[];
}

export type DiagramNode = ServiceNode | DatabaseNode | QueueNode | CloudNode | ClassNode | FlowNode;

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
}

// Clipboard types for copy/paste
export interface ClipboardNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}
