// Diagram Types

export type DiagramMode = 'architecture' | 'flow' | 'sequence' | 'c4' | 'gantt';

export interface ServiceNode {
  type: 'service';
  id: string;
  name: string;
  properties: {
    type?: 'api' | 'microservice' | 'lambda';
    tech?: string;
    port?: number;
    replicas?: number;
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

export interface FlowNode {
  type: 'flow';
  id: string;
  name: string;
  properties: {
    label?: string;
    system?: string;
    duration?: string;
    assignee?: string;
    nodeType?: 'process' | 'decision' | 'subprocess' | 'external';
  };
  isStart?: boolean;
  isEnd?: boolean;
}

export type DiagramNode = ServiceNode | DatabaseNode | QueueNode | FlowNode;

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
}

export interface ParsedDiagram {
  mode: DiagramMode;
  title: string;
  nodes: DiagramNode[];
  edges: Edge[];
  groups: Group[];
  startNode?: string;
  endNode?: string;
}

// Clipboard types for copy/paste
export interface ClipboardNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}
