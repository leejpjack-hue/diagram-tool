export interface ServiceNodeData {
  label: string;
  type?: 'api' | 'microservice' | 'lambda';
  tech?: string;
  port?: number;
  replicas?: number;
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
  nodeType?: 'process' | 'decision' | 'subprocess' | 'external' | 'data' | 'document' | 'manualinput' | 'terminator';
  isStart?: boolean;
  isEnd?: boolean;
}

export interface CloudNodeData {
  label: string;
  provider?: 'aws' | 'azure' | 'gcp' | 'k8s';
  kind?: string;
  tech?: string;
  region?: string;
}
