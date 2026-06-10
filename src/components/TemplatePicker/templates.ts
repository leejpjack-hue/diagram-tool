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
  {
    id: 'presentation-saas-overview',
    name: 'Presentation — SaaS Platform Overview',
    description: 'Slide-ready platform overview with colour-coded emoji cards — ideal for pitches and docs.',
    category: 'Architecture',
    mode: 'architecture',
    tags: ['presentation', 'cards', 'overview'],
    dsl: `diagram: architecture
title: SaaS Platform Overview
direction: LR

service Customers {
  icon: "🧑‍💻"
  color: "#0ea5e9"
  tech: "Web + Mobile"
  connects: Experience
}

service Experience {
  icon: "✨"
  color: "#6366f1"
  tech: "React 19 SPA"
  connects: Platform
}

service Platform {
  icon: "⚙️"
  color: "#8b5cf6"
  tech: "API Gateway + Services"
  connects: Intelligence, DataLake
}

service Intelligence {
  icon: "🤖"
  color: "#ec4899"
  tech: "ML Pipelines"
  connects: DataLake
}

service DataLake {
  icon: "🗄️"
  color: "#10b981"
  tech: "Postgres + S3 Lake"
}

service Operations {
  icon: "🛡️"
  color: "#f59e0b"
  tech: "Observability + SRE"
  connects: Platform
}

group FrontOffice {
  label: Customer Experience
  color: "#6366f1"
  contains: Customers, Experience
}

group BackOffice {
  label: Core Platform
  color: "#10b981"
  contains: Platform, Intelligence, DataLake, Operations
}`,
  },
  {
    id: 'gantt-product-launch',
    name: 'Product Launch Plan',
    description: 'Three-phase launch roadmap — strategy, build, and go-to-market — with owners and milestones.',
    category: 'Gantt',
    mode: 'gantt',
    tags: ['gantt', 'launch', 'roadmap'],
    dsl: `diagram: gantt
title: Product Launch Plan
start: 2026-06-08

group "Strategy" {
  task "Market Research" {
    start: 2026-06-08
    end: 2026-06-19
    assignee: "Maya"
    progress: 40
    color: "#3b82f6"
  }

  task "Positioning & Pricing" {
    start: 2026-06-22
    end: 2026-07-03
    assignee: "Maya"
    depends: "Market Research"
    color: "#06b6d4"
  }
}

group "Build" {
  task "MVP Development" {
    start: 2026-06-15
    end: 2026-07-24
    assignee: "Dev Team"
    progress: 10
    color: "#8b5cf6"
  }

  task "Beta Program" {
    start: 2026-07-27
    end: 2026-08-14
    assignee: "Dev Team"
    depends: "MVP Development"
    color: "#ec4899"
  }
}

group "Go-to-Market" {
  task "Launch Campaign" {
    start: 2026-08-03
    end: 2026-08-21
    assignee: "Marketing"
    depends: "Positioning & Pricing"
    color: "#f59e0b"
  }

  task "Public Launch" {
    start: 2026-08-24
    end: 2026-08-24
    assignee: "All"
    depends: "Beta Program"
    milestone: true
    color: "#ef4444"
  }
}`,
  },
  {
    id: 'gantt-agile-sprint',
    name: 'Agile Sprint (2 Weeks)',
    description: 'A two-week sprint board on a timeline — planning, stories, review, and retro with owners.',
    category: 'Gantt',
    mode: 'gantt',
    tags: ['gantt', 'sprint', 'agile'],
    dsl: `diagram: gantt
title: Sprint 24 — June 2026
start: 2026-06-08

task "Sprint Planning" {
  start: 2026-06-08
  end: 2026-06-08
  assignee: "Team"
  progress: 100
  color: "#3b82f6"
}

task "Story: Checkout Flow" {
  start: 2026-06-09
  end: 2026-06-15
  assignee: "Ana"
  depends: "Sprint Planning"
  progress: 60
  color: "#8b5cf6"
}

task "Story: Search Filters" {
  start: 2026-06-09
  end: 2026-06-12
  assignee: "Ben"
  depends: "Sprint Planning"
  progress: 80
  color: "#10b981"
}

task "Story: Mobile Nav" {
  start: 2026-06-11
  end: 2026-06-17
  assignee: "Chloe"
  depends: "Sprint Planning"
  progress: 30
  color: "#06b6d4"
}

task "QA & Bug Bash" {
  start: 2026-06-16
  end: 2026-06-18
  assignee: "Team"
  depends: "Story: Checkout Flow"
  color: "#f59e0b"
}

task "Sprint Review" {
  start: 2026-06-19
  end: 2026-06-19
  assignee: "Team"
  depends: "QA & Bug Bash"
  milestone: true
  color: "#ef4444"
}`,
  },
  {
    id: 'gantt-marketing-campaign',
    name: 'Marketing Campaign',
    description: 'Quarter campaign plan — creative, content, paid media, and launch week with dependencies.',
    category: 'Gantt',
    mode: 'gantt',
    tags: ['gantt', 'marketing', 'campaign'],
    dsl: `diagram: gantt
title: Q3 Campaign — Summer Release
start: 2026-06-15

group "Creative" {
  task "Brand Refresh" {
    start: 2026-06-15
    end: 2026-06-26
    assignee: "Design"
    progress: 20
    color: "#ec4899"
  }

  task "Asset Production" {
    start: 2026-06-29
    end: 2026-07-17
    assignee: "Design"
    depends: "Brand Refresh"
    color: "#8b5cf6"
  }
}

group "Content" {
  task "Landing Page" {
    start: 2026-06-22
    end: 2026-07-03
    assignee: "Web"
    color: "#3b82f6"
  }

  task "Email Sequence" {
    start: 2026-07-06
    end: 2026-07-15
    assignee: "Lifecycle"
    depends: "Landing Page"
    color: "#06b6d4"
  }
}

group "Media" {
  task "Paid Social Setup" {
    start: 2026-07-13
    end: 2026-07-22
    assignee: "Growth"
    depends: "Asset Production"
    color: "#10b981"
  }

  task "Campaign Live" {
    start: 2026-07-27
    end: 2026-07-27
    assignee: "All"
    depends: "Paid Social Setup"
    milestone: true
    color: "#ef4444"
  }
}`,
  },
];
