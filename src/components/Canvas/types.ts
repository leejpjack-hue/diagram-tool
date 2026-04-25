export type C4Level = 'context' | 'container' | 'component' | 'code';

export interface ServiceNodeData {
  label: string;
  type?: 'api' | 'microservice' | 'lambda';
  tech?: string;
  port?: number;
  replicas?: number;
  level?: C4Level;
  parent?: string;
}

export interface DatabaseNodeData {
  label: string;
  type?: 'postgresql' | 'mongodb' | 'mysql' | 'redis';
  data?: string[];
}

export interface QueueNodeData {
  label: string;
  type?: 'kafka' | 'rabbitmq' | 'sqs';
  topic?: string;
}

export interface FlowNodeData {
  label: string;
  system?: string;
  duration?: string;
  assignee?: string;
  nodeType?:
    | 'process' | 'decision' | 'subprocess' | 'external'
    | 'data' | 'document' | 'manualinput' | 'terminator'
    | 'gatewayexclusive' | 'gatewayparallel' | 'gatewayinclusive'
    | 'eventstart' | 'eventend' | 'eventtimer' | 'eventmessage';
  isStart?: boolean;
  isEnd?: boolean;
  lane?: string;
}

export interface CloudNodeData {
  label: string;
  provider?: 'aws' | 'azure' | 'gcp' | 'k8s';
  kind?: string;
  tech?: string;
  region?: string;
  level?: C4Level;
  parent?: string;
}

export interface ClassNodeData {
  label: string;
  stereotype?: string;
  attributes?: string[];
  methods?: string[];
  level?: C4Level;
  parent?: string;
}
