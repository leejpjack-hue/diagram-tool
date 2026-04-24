export type TemplateCategory = 'Architecture' | 'Flow' | 'Gantt';

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  mode: 'architecture' | 'flow' | 'gantt';
  tags: string[];
  dsl: string;
}

export const TEMPLATES: DiagramTemplate[] = [
  {
    id: 'aws-three-tier',
    name: 'AWS 3-Tier Web Application',
    description: 'Classic web/app/DB layout on AWS with CloudFront, API Gateway, Lambda, RDS, and S3.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['aws', 'serverless', 'web'],
    dsl: `diagram: architecture
title: AWS 3-Tier Web App

cloud CDN {
  provider: aws
  kind: cloudfront
  connects: WebApi
}

cloud WebApi {
  provider: aws
  kind: apigateway
  connects: OrdersFn, CatalogFn
}

cloud OrdersFn {
  provider: aws
  kind: lambda
  tech: Node.js 20
  connects: OrdersDb
}

cloud CatalogFn {
  provider: aws
  kind: lambda
  tech: Python 3.11
  connects: CatalogDb, Assets
}

cloud OrdersDb {
  provider: aws
  kind: rds
  tech: PostgreSQL
}

cloud CatalogDb {
  provider: aws
  kind: dynamodb
}

cloud Assets {
  provider: aws
  kind: s3
}`,
  },
  {
    id: 'k8s-microservices',
    name: 'Kubernetes Microservices',
    description: 'Ingress → services → pods pattern with ConfigMaps and a managed database.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['k8s', 'microservices', 'containers'],
    dsl: `diagram: architecture
title: Kubernetes Microservices

cloud Ingress {
  provider: k8s
  kind: ingress
  connects: ApiGateway
}

cloud ApiGateway {
  provider: k8s
  kind: service
  connects: AuthPod, OrdersPod, InventoryPod
}

cloud AuthPod {
  provider: k8s
  kind: pod
  tech: Node.js
}

cloud OrdersPod {
  provider: k8s
  kind: pod
  tech: Go
  connects: OrdersDb, EventBus
}

cloud InventoryPod {
  provider: k8s
  kind: pod
  tech: Java
  connects: InventoryDb
}

cloud AppConfig {
  provider: k8s
  kind: configmap
}

database OrdersDb {
  type: postgresql
}

database InventoryDb {
  type: postgresql
}

queue EventBus {
  type: kafka
  topic: domain-events
}`,
  },
  {
    id: 'gcp-data-pipeline',
    name: 'GCP Data Pipeline',
    description: 'Event-driven pipeline on Google Cloud with Pub/Sub, Cloud Functions, and BigQuery.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['gcp', 'data', 'analytics'],
    dsl: `diagram: architecture
title: GCP Analytics Pipeline

cloud Source {
  provider: gcp
  kind: gcs
  connects: IngestFn
}

cloud IngestFn {
  provider: gcp
  kind: cloudfunction
  tech: Python
  connects: EventStream
}

queue EventStream {
  type: kafka
  topic: raw-events
}

cloud Warehouse {
  provider: gcp
  kind: bigquery
}

cloud TransformFn {
  provider: gcp
  kind: cloudfunction
  tech: Python
  connects: Warehouse
}`,
  },
  {
    id: 'c4-context-insurance',
    name: 'C4 System Context (Insurance)',
    description: 'Top-level C4 context diagram showing external users and integrations for a claims platform.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['c4', 'context'],
    dsl: `diagram: architecture
title: Claims Platform - System Context

service Customer {
  type: api
  tech: Web / Mobile
  connects: ClaimsPlatform
}

service ClaimsAdjuster {
  type: api
  tech: Internal Portal
  connects: ClaimsPlatform
}

service ClaimsPlatform {
  type: microservice
  tech: Core System
  connects: PolicyAdmin, PaymentGateway, FraudService
}

service PolicyAdmin {
  type: microservice
  tech: External
}

service PaymentGateway {
  type: microservice
  tech: Stripe / Adyen
}

service FraudService {
  type: microservice
  tech: 3rd-party ML
}`,
  },
  {
    id: 'flow-user-signup',
    name: 'Flowchart — User Signup',
    description: 'Standard flowchart using start/end, process, decision, data, and document shapes.',
    category: 'Flow',
    mode: 'flow',
    tags: ['flowchart', 'signup'],
    dsl: `diagram: flow
title: User Signup

start Begin

Begin -> EnterEmail
EnterEmail -> ValidateEmail

ValidateEmail ->|Valid| CreateAccount
ValidateEmail ->|Invalid| ShowError

ShowError -> EnterEmail

CreateAccount -> SendWelcome
SendWelcome -> WelcomeEmail
WelcomeEmail -> Complete

end Complete

node EnterEmail {
  type: manualinput
  label: Enter Email
}

node ValidateEmail {
  type: decision
  label: Email Valid?
}

node CreateAccount {
  type: data
  label: Account Record
  system: UserDB
}

node SendWelcome {
  label: Send Welcome
  system: NotificationSvc
}

node WelcomeEmail {
  type: document
  label: Welcome Email
}

node ShowError {
  label: Show Error
}`,
  },
  {
    id: 'flow-order-processing',
    name: 'BPMN — Order Processing',
    description: 'Order fulfilment flow with decision gateways and document artifacts.',
    category: 'Flow',
    mode: 'flow',
    tags: ['bpmn', 'orders'],
    dsl: `diagram: flow
title: Order Processing

start OrderPlaced

OrderPlaced -> CheckInventory
CheckInventory -> Available

Available ->|In Stock| ChargePayment
Available ->|Out of Stock| Backorder

Backorder -> BackorderDoc
BackorderDoc -> NotifyCustomer
NotifyCustomer -> OrderClosed

ChargePayment -> PaymentOk
PaymentOk ->|Success| Pack
PaymentOk ->|Declined| RefundFlow

RefundFlow -> OrderClosed

Pack -> Ship -> Invoice
Invoice -> OrderClosed

end OrderClosed

node CheckInventory {
  label: Check Inventory
  system: Warehouse
}

node Available {
  type: decision
  label: Stock?
}

node Backorder {
  label: Create Backorder
}

node BackorderDoc {
  type: document
  label: Backorder Slip
}

node ChargePayment {
  label: Charge Payment
  system: PaymentGateway
}

node PaymentOk {
  type: decision
  label: Payment OK?
}

node RefundFlow {
  label: Refund
}

node Pack {
  label: Pack Goods
}

node Ship {
  type: data
  label: Shipment
}

node Invoice {
  type: document
  label: Invoice PDF
}

node NotifyCustomer {
  label: Notify Customer
  system: NotificationSvc
}`,
  },
];
