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
