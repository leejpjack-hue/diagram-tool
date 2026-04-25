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
    id: 'c4-hierarchical-drill',
    name: 'C4 Hierarchical (Levels 1–3)',
    description: 'Same system at three C4 levels — switch between Context / Container / Component to drill down.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['c4', 'hierarchy', 'drill-down'],
    dsl: `diagram: architecture
title: Banking Platform — C4 Drill-Down

# Level 1: Context
service Customer {
  type: api
  tech: External User
  level: context
  connects: BankingApp
}

service BankingApp {
  type: microservice
  tech: System Boundary
  level: context
  connects: PaymentGateway, EmailSvc
}

service PaymentGateway {
  type: microservice
  tech: External
  level: context
}

service EmailSvc {
  type: microservice
  tech: External
  level: context
}

# Level 2: Container
service WebApp {
  type: api
  tech: React SPA
  level: container
  parent: bankingapp
  connects: WebApi
}

service Mobile {
  type: api
  tech: iOS / Android
  level: container
  parent: bankingapp
  connects: WebApi
}

service WebApi {
  type: api
  tech: Spring Boot
  level: container
  parent: bankingapp
  connects: AccountSvc, TxSvc
}

service AccountSvc {
  type: microservice
  tech: Java
  level: container
  parent: bankingapp
  connects: AccountDb
}

service TxSvc {
  type: microservice
  tech: Java
  level: container
  parent: bankingapp
  connects: TxDb
}

database AccountDb {
  type: postgresql
  data: accounts, profiles
}

database TxDb {
  type: postgresql
  data: ledger, transactions
}

# Level 3: Component (inside TxSvc)
service TxController {
  type: api
  tech: REST controller
  level: component
  parent: txsvc
  connects: TxValidator
}

service TxValidator {
  type: microservice
  tech: Validation rules
  level: component
  parent: txsvc
  connects: TxRepository
}

service TxRepository {
  type: microservice
  tech: JPA
  level: component
  parent: txsvc
}`,
  },
  {
    id: 'er-diagram',
    name: 'ER Diagram — E-Commerce',
    description: 'Entity-Relationship diagram using UML class shapes for tables and their relations.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['er', 'database', 'uml'],
    dsl: `diagram: architecture
title: E-Commerce ER Diagram

class Customer {
  stereotype: entity
  attributes: id: PK, email: string, created_at: timestamp
  methods: place_order(), update_profile()
  connects: Order, Address
}

class Address {
  stereotype: entity
  attributes: id: PK, customer_id: FK, line1: string, city: string, postal_code: string
}

class Order {
  stereotype: entity
  attributes: id: PK, customer_id: FK, total: decimal, status: enum
  methods: cancel(), fulfill()
  connects: OrderLine, Payment
}

class OrderLine {
  stereotype: entity
  attributes: id: PK, order_id: FK, product_id: FK, qty: int, price: decimal
  connects: Product
}

class Product {
  stereotype: entity
  attributes: id: PK, sku: string, name: string, price: decimal, stock: int
}

class Payment {
  stereotype: entity
  attributes: id: PK, order_id: FK, amount: decimal, method: enum, captured_at: timestamp
}`,
  },
  {
    id: 'network-topology',
    name: 'Network Topology — Multi-Tier',
    description: 'Internet → WAF/CDN → ALB → public subnet services → private subnet databases.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['network', 'topology', 'aws'],
    dsl: `diagram: architecture
title: Multi-Tier Network Topology

cloud Internet {
  provider: aws
  kind: cloudfront
  connects: WAF
}

cloud WAF {
  provider: aws
  kind: cloudfront
  region: edge
  connects: ALB
}

cloud ALB {
  provider: aws
  kind: apigateway
  region: us-east-1
  connects: WebTier1, WebTier2
}

service WebTier1 {
  type: api
  tech: Nginx
  connects: AppTier
}

service WebTier2 {
  type: api
  tech: Nginx
  connects: AppTier
}

service AppTier {
  type: microservice
  tech: Node.js
  replicas: 4
  connects: PrimaryDb, Cache, FileStore
}

database PrimaryDb {
  type: postgresql
  data: users, orders
}

database Cache {
  type: redis
  data: sessions, hot-objects
}

cloud FileStore {
  provider: aws
  kind: s3
  region: us-east-1
}`,
  },
  {
    id: 'uml-class-diagram',
    name: 'UML Class Diagram — Auth System',
    description: 'Classic UML classes with attributes and methods — User, Session, AuthService.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['uml', 'class', 'oop'],
    dsl: `diagram: architecture
title: Authentication — UML Classes

class User {
  attributes: id: UUID, email: string, password_hash: string, created_at: DateTime
  methods: verify_password(pwd): bool, change_email(new): void
  connects: Session
}

class Session {
  attributes: id: UUID, user_id: UUID, token: string, expires_at: DateTime
  methods: is_valid(): bool, revoke(): void
}

class AuthService {
  stereotype: service
  attributes: jwt_secret: string, ttl: int
  methods: login(email, pwd): Session, logout(token): void, refresh(token): Session
  connects: User, Session, TokenRepo
}

class TokenRepo {
  stereotype: repository
  methods: save(t: Session): void, find(token): Session, revoke_all(user_id): void
}`,
  },
  {
    id: 'flow-swimlane-loan',
    name: 'Swimlane — Loan Approval',
    description: 'Cross-functional flow with Customer, Loan Officer, Underwriter, and System swimlanes.',
    category: 'Flow',
    mode: 'flow',
    tags: ['swimlane', 'process', 'bpmn'],
    dsl: `diagram: flow
title: Loan Approval Process

start ApplicationSubmitted

ApplicationSubmitted -> CollectDocs
CollectDocs -> ReviewDocs
ReviewDocs -> CreditCheck
CreditCheck -> RiskGateway
RiskGateway ->|Low Risk| AutoApprove
RiskGateway ->|High Risk| ManualReview
ManualReview -> UnderwriterDecision
UnderwriterDecision ->|Approved| FundLoan
UnderwriterDecision ->|Rejected| NotifyDecline
AutoApprove -> FundLoan
FundLoan -> NotifyApprove
NotifyApprove -> Closed
NotifyDecline -> Closed

end Closed

node ApplicationSubmitted {
  type: eventstart
  label: Application Submitted
}

node CollectDocs {
  label: Submit Documents
}

node ReviewDocs {
  label: Review Documents
}

node CreditCheck {
  type: data
  label: Credit Report
  system: Equifax
}

node RiskGateway {
  type: gatewayexclusive
  label: Risk Level?
}

node AutoApprove {
  label: Auto-Approve
}

node ManualReview {
  label: Manual Review
}

node UnderwriterDecision {
  type: gatewayexclusive
  label: Decision?
}

node FundLoan {
  label: Disburse Funds
  system: CoreBanking
}

node NotifyApprove {
  type: eventmessage
  label: Approval Email
}

node NotifyDecline {
  type: eventmessage
  label: Decline Email
}

node Closed {
  type: eventend
  label: Closed
}

lane Customer {
  contains: ApplicationSubmitted, CollectDocs, NotifyApprove, NotifyDecline
}

lane LoanOfficer {
  contains: ReviewDocs, ManualReview
}

lane Underwriter {
  contains: UnderwriterDecision
}

lane System {
  contains: CreditCheck, RiskGateway, AutoApprove, FundLoan, Closed
}`,
  },
  {
    id: 'flow-bpmn-events',
    name: 'BPMN — Events & Gateways',
    description: 'Showcase BPMN gateway diamonds (XOR/AND) and event circles (timer/message).',
    category: 'Flow',
    mode: 'flow',
    tags: ['bpmn', 'gateways', 'events'],
    dsl: `diagram: flow
title: BPMN Showcase — Order to Ship

start OrderReceived

OrderReceived -> CheckStock
CheckStock -> StockGate
StockGate ->|In Stock| Reserve
StockGate ->|Out| Wait7Days
Wait7Days -> CheckStock
Reserve -> Parallel
Parallel -> Pack
Parallel -> Invoice
Pack -> Joined
Invoice -> Joined
Joined -> Shipped

end Shipped

node OrderReceived {
  type: eventstart
  label: Order Received
}

node CheckStock {
  label: Check Stock
}

node StockGate {
  type: gatewayexclusive
  label: Stock?
}

node Reserve {
  label: Reserve Items
}

node Wait7Days {
  type: eventtimer
  label: Wait 7 Days
}

node Parallel {
  type: gatewayparallel
  label: Fork
}

node Pack {
  label: Pack
}

node Invoice {
  type: document
  label: Invoice
}

node Joined {
  type: gatewayparallel
  label: Join
}

node Shipped {
  type: eventend
  label: Shipped
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
  {
    id: 'flow-bpmn-subprocess',
    name: 'BPMN Subprocess (Order Fulfillment)',
    description: 'BPMN flow with collapsed and expanded subprocess markers driving an end-to-end fulfillment pipeline.',
    category: 'Flow',
    mode: 'flow',
    tags: ['flow', 'bpmn', 'subprocess'],
    dsl: `diagram: flow
title: Order Fulfillment with Subprocesses

node OrderReceived {
  type: eventstart
  label: Order Received
}

node ValidateOrder {
  type: subprocesscollapsed
  label: Validate Order
}

node ReserveInventory {
  type: subprocesscollapsed
  label: Reserve Inventory
}

node PaymentFlow {
  type: subprocessexpanded
  label: Process Payment
}

node Fulfillment {
  type: subprocesscollapsed
  label: Pack and Ship
}

node OrderComplete {
  type: eventend
  label: Order Complete
}

OrderReceived -> ValidateOrder
ValidateOrder -> ReserveInventory
ReserveInventory -> PaymentFlow
PaymentFlow -> Fulfillment
Fulfillment -> OrderComplete
`,
  },
];
