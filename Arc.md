# RentPilot — Production Implementation Blueprint

Your specification is strong enough to become the project’s product requirements document. Before implementation, I would make several architectural corrections to prevent routing conflicts, security problems, and long-term maintenance issues.

## 1. Finalized Technology Stack

### Monorepo

Use a `pnpm` workspace with Turborepo:

```text
rentpilot/
├── apps/
│   ├── web/
│   ├── mobile/
│   └── api/
├── packages/
│   ├── api-client/
│   ├── config/
│   ├── eslint-config/
│   ├── schemas/
│   ├── types/
│   ├── ui-tokens/
│   └── utils/
├── infrastructure/
├── docs/
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Shared Zod schemas, API types, constants, currency helpers, and design tokens should live in `packages/`.

---

## 2. Important Stack Corrections

### Next.js and React Router

Do not install React Router DOM in the Next.js application.

Next.js App Router already provides file-based routing, layouts, route groups, loading states, error boundaries, server components, and middleware. Adding React Router would create two routing systems and unnecessary complexity. The current Next.js documentation recommends the App Router for modern applications. ([Next.js][1])

Use:

```text
Next.js App Router
React 19
TypeScript
Tailwind CSS
shadcn/ui
TanStack Query
React Hook Form
Zod
Axios
Recharts
Framer Motion
next-themes
```

### Mobile

Use Expo rather than bare React Native CLI.

Expo provides a faster production workflow for:

* Android and iOS builds
* Push notifications
* Biometrics
* Secure storage
* Camera and image uploads
* Deep linking
* Over-the-air updates
* App-store builds

Expo is currently positioned as a full React Native framework with native services and file-based routing support. ([Expo Documentation][2])

Recommended mobile stack:

```text
Expo
Expo Router
TypeScript
NativeWind
TanStack Query
React Hook Form
Zod
Axios
Expo Notifications
Expo Secure Store
Expo Local Authentication
NetInfo
SQLite
```

Do not combine React Navigation configuration manually with Expo Router unless a feature specifically requires it. Expo Router already builds on React Navigation.

---

# 3. Recommended Architecture

```text
Web PWA ───────────────┐
                       │
Mobile App ────────────┼──── REST API ─── PostgreSQL
                       │         │
Tenant Portal ─────────┘         ├── Firebase Admin
                                 ├── Paystack
                                 ├── Flutterwave
                                 ├── Cloudinary
                                 ├── Termii
                                 ├── Nodemailer
                                 ├── Redis/BullMQ
                                 └── Object storage
```

The web and mobile clients should never access PostgreSQL or Prisma directly.

All business logic must pass through the Express API.

---

# 4. Multi-Tenant SaaS Model

RentPilot should be organization-based, not merely user-based.

A user may belong to one or more organizations. Each organization may represent:

* A landlord business
* A property management company
* A real estate agency
* A branch or subsidiary

Core hierarchy:

```text
User
  └── Organization Membership
        ├── Role
        └── Organization
              ├── Properties
              ├── Units
              ├── Tenants
              ├── Leases
              ├── Payments
              └── Documents
```

Every tenant-owned database record should contain:

```prisma
organizationId String
```

Every protected query must filter by the authenticated organization:

```ts
await prisma.property.findMany({
  where: {
    organizationId: request.auth.organizationId,
  },
});
```

This prevents one landlord from accessing another landlord’s records.

---

# 5. Authentication Design

Firebase Authentication should handle user identity.

The Express backend should handle:

* Organization membership
* Application roles
* Permissions
* Account suspension
* Subscription access
* Audit logging
* Tenant portal access

## Authentication flow

1. User signs in using Firebase.
2. Firebase returns an ID token.
3. Web or mobile sends the token:

```http
Authorization: Bearer <firebase-id-token>
```

4. Express verifies it using Firebase Admin.
5. Express finds or provisions the local user.
6. Express loads organization membership and role.
7. Authorization middleware checks the required permission.
8. The request continues.

Firebase officially recommends verifying client ID tokens on the server using the Firebase Admin SDK and a service account. ([Firebase][3])

Example middleware design:

```ts
export type AuthContext = {
  firebaseUid: string;
  userId: string;
  organizationId: string;
  role: AppRole;
  permissions: Permission[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
```

Do not create a second password system in PostgreSQL.

Do not store Firebase refresh tokens in the database unless a specific server-side workflow requires them.

---

# 6. Roles and Permissions

Use permissions rather than checking role names throughout the code.

```ts
export const permissions = {
  propertyRead: "property:read",
  propertyCreate: "property:create",
  propertyUpdate: "property:update",
  propertyDelete: "property:delete",

  tenantRead: "tenant:read",
  tenantCreate: "tenant:create",
  tenantUpdate: "tenant:update",

  paymentRead: "payment:read",
  paymentCreate: "payment:create",
  paymentRefund: "payment:refund",

  reportRead: "report:read",
  settingsManage: "settings:manage",
  userManage: "user:manage",
} as const;
```

Suggested access matrix:

| Feature                 | Super Admin | Landlord | Property Manager |    Agent |        Tenant |
| ----------------------- | ----------: | -------: | ---------------: | -------: | ------------: |
| Platform administration |        Full |       No |               No |       No |            No |
| Organization settings   |        Full |     Full |          Limited |       No |            No |
| Properties              |        Full |     Full |         Assigned | Assigned | View assigned |
| Tenants                 |        Full |     Full |         Assigned | Assigned |   Own profile |
| Payments                |        Full |     Full |         Assigned |     Read |  Own payments |
| Refunds                 |        Full |     Full |         Optional |       No |            No |
| Legal documents         |        Full |     Full |         Assigned |  Limited | Own documents |
| Reports                 |        Full |     Full |         Assigned |  Limited | Own statement |

`Super Admin` should be treated as a platform-level role, not an ordinary organization role.

---

# 7. Core Database Design

Your table list needs several additions to support a scalable SaaS platform.

## Identity and organizations

```text
User
Organization
OrganizationMembership
Role
Permission
RolePermission
Invitation
SessionLog
Device
```

## Property operations

```text
Property
PropertyImage
Unit
UnitImage
Tenant
TenantDocument
Lease
LeaseTenant
LeaseDocument
```

## Finance

```text
RentSchedule
Payment
PaymentAllocation
Transaction
Invoice
Receipt
Refund
BankAccount
PaymentProviderConfig
```

## Communication

```text
ReminderRule
ReminderLog
Notification
NotificationPreference
MessageTemplate
EmailLog
SmsLog
PushToken
```

## Operations

```text
MaintenanceRequest
MaintenanceComment
MaintenanceAttachment
MaintenanceAssignment
PropertyExpense
Vendor
```

## Documents and legal

```text
LegalDocument
DocumentTemplate
DocumentVersion
DocumentSignature
DocumentExpiry
```

## SaaS platform

```text
Plan
Subscription
SubscriptionInvoice
FeatureEntitlement
UsageRecord
AuditLog
ActivityLog
WebhookEvent
IdempotencyKey
OrganizationSetting
UserSetting
```

---

# 8. Critical Finance Model

A single payment may cover:

* One month
* Several months
* Part of a month
* Arrears
* Service charges
* Deposits
* Late fees

Therefore, do not attach a payment directly to only one lease month.

Use:

```text
RentSchedule
    └── expected amount for a particular billing period

Payment
    └── money received from the tenant

PaymentAllocation
    └── portion of a payment applied to a rent schedule
```

Example:

```text
Payment: ₦900,000

Allocation 1:
January rent — ₦300,000

Allocation 2:
February rent — ₦300,000

Allocation 3:
March rent — ₦300,000
```

This model supports partial payment and overpayment correctly.

---

# 9. Suggested Prisma Models

```prisma
enum OrganizationRole {
  OWNER
  PROPERTY_MANAGER
  AGENT
  ACCOUNTANT
}

enum UnitStatus {
  VACANT
  OCCUPIED
  RESERVED
  MAINTENANCE
  INACTIVE
}

enum LeaseStatus {
  DRAFT
  ACTIVE
  EXPIRING
  EXPIRED
  TERMINATED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PROCESSING
  PARTIALLY_ALLOCATED
  PAID
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum PaymentProvider {
  MANUAL
  PAYSTACK
  FLUTTERWAVE
  BANK_TRANSFER
}

model User {
  id            String   @id @default(cuid())
  firebaseUid   String   @unique
  email         String   @unique
  fullName      String
  phone         String?
  avatarUrl     String?
  emailVerified Boolean  @default(false)
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  memberships OrganizationMembership[]
  auditLogs   AuditLog[]
}

model Organization {
  id                 String   @id @default(cuid())
  name               String
  slug               String   @unique
  businessName       String?
  registrationNumber String?
  taxNumber          String?
  phone              String?
  email              String?
  logoUrl            String?
  currency           String   @default("NGN")
  timezone           String   @default("Africa/Lagos")
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  memberships OrganizationMembership[]
  properties  Property[]
  tenants     Tenant[]
  leases      Lease[]
  payments    Payment[]
}

model OrganizationMembership {
  id             String           @id @default(cuid())
  userId         String
  organizationId String
  role           OrganizationRole
  isActive       Boolean          @default(true)
  createdAt      DateTime         @default(now())

  user         User         @relation(fields: [userId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
  @@index([organizationId, role])
}

model Property {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  addressLine1   String
  addressLine2   String?
  city           String
  state          String
  country        String   @default("Nigeria")
  description    String?
  propertyType   String
  status         String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  units        Unit[]

  @@index([organizationId])
  @@index([organizationId, status])
}

model Unit {
  id         String     @id @default(cuid())
  propertyId String
  unitNumber String
  floor      String?
  bedrooms   Int?
  bathrooms  Int?
  rentAmount Decimal    @db.Decimal(18, 2)
  status     UnitStatus @default(VACANT)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  property Property @relation(fields: [propertyId], references: [id])
  leases   Lease[]

  @@unique([propertyId, unitNumber])
  @@index([propertyId, status])
}

model Tenant {
  id               String   @id @default(cuid())
  organizationId   String
  firebaseUid      String?  @unique
  fullName         String
  email            String?
  phone             String
  passportPhotoUrl String?
  nationalId       String?
  occupation       String?
  employer         String?
  address          String?
  notes            String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  deletedAt        DateTime?

  organization Organization @relation(fields: [organizationId], references: [id])
  leases       Lease[]

  @@index([organizationId])
  @@index([organizationId, fullName])
  @@index([organizationId, phone])
}

model Lease {
  id             String      @id @default(cuid())
  organizationId String
  tenantId       String
  unitId         String
  startDate      DateTime
  endDate        DateTime
  rentAmount     Decimal     @db.Decimal(18, 2)
  depositAmount  Decimal     @default(0) @db.Decimal(18, 2)
  billingCycle   String
  dueDay         Int
  status         LeaseStatus @default(DRAFT)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization  Organization @relation(fields: [organizationId], references: [id])
  tenant        Tenant       @relation(fields: [tenantId], references: [id])
  unit          Unit         @relation(fields: [unitId], references: [id])
  rentSchedules RentSchedule[]

  @@index([organizationId, status])
  @@index([tenantId])
  @@index([unitId])
  @@index([endDate])
}

model RentSchedule {
  id          String   @id @default(cuid())
  leaseId     String
  periodStart DateTime
  periodEnd   DateTime
  dueDate     DateTime
  amountDue   Decimal  @db.Decimal(18, 2)
  amountPaid  Decimal  @default(0) @db.Decimal(18, 2)
  status      String
  createdAt   DateTime @default(now())

  lease       Lease               @relation(fields: [leaseId], references: [id])
  allocations PaymentAllocation[]

  @@unique([leaseId, periodStart, periodEnd])
  @@index([dueDate, status])
}

model Payment {
  id                  String          @id @default(cuid())
  organizationId      String
  tenantId            String
  provider             PaymentProvider
  providerReference    String?
  internalReference    String          @unique
  amount               Decimal         @db.Decimal(18, 2)
  currency             String          @default("NGN")
  status               PaymentStatus
  paymentDate          DateTime?
  verifiedAt           DateTime?
  providerResponse     Json?
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt

  organization Organization        @relation(fields: [organizationId], references: [id])
  allocations  PaymentAllocation[]

  @@index([organizationId, status])
  @@index([tenantId])
  @@index([providerReference])
}

model PaymentAllocation {
  id             String   @id @default(cuid())
  paymentId      String
  rentScheduleId String
  amount         Decimal  @db.Decimal(18, 2)
  createdAt      DateTime @default(now())

  payment      Payment      @relation(fields: [paymentId], references: [id])
  rentSchedule RentSchedule @relation(fields: [rentScheduleId], references: [id])

  @@unique([paymentId, rentScheduleId])
}
```

Prisma supports PostgreSQL and provides typed database access suitable for this architecture. ([Prisma][4])

---

# 10. Backend Folder Structure

```text
apps/api/src/
├── app.ts
├── server.ts
├── config/
│   ├── env.ts
│   ├── firebase-admin.ts
│   ├── logger.ts
│   └── prisma.ts
├── modules/
│   ├── auth/
│   ├── organizations/
│   ├── users/
│   ├── properties/
│   ├── units/
│   ├── tenants/
│   ├── leases/
│   ├── rent-schedules/
│   ├── payments/
│   ├── reminders/
│   ├── maintenance/
│   ├── legal/
│   ├── documents/
│   ├── reports/
│   ├── notifications/
│   ├── subscriptions/
│   └── admin/
├── middleware/
│   ├── authenticate.middleware.ts
│   ├── authorize.middleware.ts
│   ├── organization.middleware.ts
│   ├── error.middleware.ts
│   ├── rate-limit.middleware.ts
│   └── validate.middleware.ts
├── integrations/
│   ├── cloudinary/
│   ├── firebase/
│   ├── flutterwave/
│   ├── nodemailer/
│   ├── paystack/
│   └── termii/
├── jobs/
│   ├── reminder.job.ts
│   ├── lease-expiry.job.ts
│   └── payment-reconciliation.job.ts
├── events/
├── utils/
├── types/
└── tests/
```

Each module should contain:

```text
properties/
├── property.controller.ts
├── property.service.ts
├── property.repository.ts
├── property.routes.ts
├── property.schema.ts
├── property.dto.ts
├── property.mapper.ts
└── property.types.ts
```

---

# 11. Web Application Structure

```text
apps/web/src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── verify-email/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── properties/
│   │   ├── units/
│   │   ├── tenants/
│   │   ├── leases/
│   │   ├── payments/
│   │   ├── reminders/
│   │   ├── maintenance/
│   │   ├── legal/
│   │   ├── reports/
│   │   ├── notifications/
│   │   └── settings/
│   ├── tenant/
│   ├── admin/
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/
│   ├── data-table/
│   ├── forms/
│   ├── charts/
│   └── feedback/
├── features/
├── hooks/
├── lib/
├── providers/
├── services/
├── stores/
├── styles/
└── types/
```

---

# 12. API Design

Use versioned endpoints:

```text
/api/v1
```

## Authentication

```http
POST   /api/v1/auth/session
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
POST   /api/v1/auth/switch-organization
```

## Properties and units

```http
GET    /api/v1/properties
POST   /api/v1/properties
GET    /api/v1/properties/:propertyId
PATCH  /api/v1/properties/:propertyId
DELETE /api/v1/properties/:propertyId

GET    /api/v1/properties/:propertyId/units
POST   /api/v1/properties/:propertyId/units
GET    /api/v1/units/:unitId
PATCH  /api/v1/units/:unitId
DELETE /api/v1/units/:unitId
```

## Tenants and leases

```http
GET    /api/v1/tenants
POST   /api/v1/tenants
GET    /api/v1/tenants/:tenantId
PATCH  /api/v1/tenants/:tenantId
DELETE /api/v1/tenants/:tenantId
GET    /api/v1/tenants/:tenantId/history

GET    /api/v1/leases
POST   /api/v1/leases
GET    /api/v1/leases/:leaseId
PATCH  /api/v1/leases/:leaseId
POST   /api/v1/leases/:leaseId/activate
POST   /api/v1/leases/:leaseId/renew
POST   /api/v1/leases/:leaseId/terminate
```

## Payments

```http
POST   /api/v1/payments/initialize
POST   /api/v1/payments/manual
GET    /api/v1/payments
GET    /api/v1/payments/:paymentId
POST   /api/v1/payments/:paymentId/verify
POST   /api/v1/payments/:paymentId/refund
GET    /api/v1/payments/:paymentId/receipt

POST   /api/v1/webhooks/paystack
POST   /api/v1/webhooks/flutterwave
```

## Dashboard

```http
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/revenue
GET /api/v1/dashboard/occupancy
GET /api/v1/dashboard/upcoming-rent
GET /api/v1/dashboard/recent-activity
```

Example summary response:

```json
{
  "data": {
    "properties": 12,
    "units": 78,
    "occupiedUnits": 62,
    "vacantUnits": 16,
    "tenants": 62,
    "expectedRent": 18500000,
    "collectedRent": 14200000,
    "outstandingRent": 4300000,
    "overdueRent": 1700000,
    "currency": "NGN"
  }
}
```

---

# 13. API Response Standard

Success:

```json
{
  "success": true,
  "message": "Property created successfully.",
  "data": {},
  "meta": null
}
```

Paginated success:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "PROPERTY_NOT_FOUND",
    "message": "The requested property could not be found.",
    "details": null,
    "requestId": "req_01J..."
  }
}
```

---

# 14. Payment Security

Payment providers must be implemented through adapters:

```ts
export interface PaymentGateway {
  initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult>;

  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;

  verifyWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<VerifiedWebhookEvent>;
}
```

Mandatory controls:

* Verify webhook signatures
* Store provider event IDs
* Reject duplicate events
* Use database transactions
* Add idempotency keys
* Never trust payment status from the frontend
* Reconcile provider payments periodically
* Encrypt private API keys
* Never send secret keys to web or mobile clients

---

# 15. Reminder Architecture

Do not run reminder scheduling inside the main Express request process.

Use:

```text
Redis
BullMQ
Worker process
Scheduled jobs
```

Reminder process:

1. Generate upcoming rent schedules.
2. Find reminders due for dispatch.
3. Add jobs to the queue.
4. Worker sends email, SMS, or push notification.
5. Store provider response.
6. Retry temporary failures.
7. Mark permanently failed messages.
8. Prevent duplicate delivery using idempotency keys.

Recommended default reminder schedule:

```text
30 days before lease expiry
14 days before rent due
7 days before rent due
3 days before rent due
On the due date
3 days overdue
7 days overdue
14 days overdue
30 days overdue
```

Each organization should be able to customize these rules.

---

# 16. Offline Strategy

Offline support should not mean every feature works without internet.

## Web PWA

Cache:

* Application shell
* Static assets
* Recently viewed properties
* Recently viewed tenants
* Draft maintenance requests

Do not cache:

* Payment verification responses
* Sensitive legal documents without encryption
* Secret configuration
* Complete audit history

## Mobile

Use SQLite for:

* Cached dashboard
* Properties
* Units
* Tenants
* Draft maintenance requests
* Pending photo uploads

Store queued mutations with:

```text
mutationId
resource
operation
payload
createdAt
retryCount
syncStatus
```

Conflict handling should use server timestamps and version fields.

---

# 17. Security Requirements

Production security must include:

* Firebase ID-token verification
* Role and permission middleware
* Organization-level data isolation
* Rate limiting
* Secure HTTP headers
* CORS allowlist
* Request-size limits
* Zod validation
* Audit logging
* Cloudinary signed uploads
* Webhook signature verification
* Secret encryption
* Database backups
* Soft deletion
* Refresh-token revocation support
* Session and device history
* File MIME-type validation
* Malware scanning for legal documents
* Sensitive-field redaction in logs
* Idempotency for financial operations

Payment provider keys should not be stored as ordinary plain-text settings.

---

# 18. Design System

Use CSS variables as the source of truth.

```css
:root {
  --background: 248 250 252;
  --foreground: 15 23 42;
  --card: 255 255 255;
  --primary: 22 163 74;
  --secondary: 34 197 94;
  --muted: 100 116 139;
  --border: 226 232 240;
  --danger: 220 38 38;
  --warning: 245 158 11;
  --radius: 0.875rem;
}

.dark {
  --background: 15 23 42;
  --foreground: 248 250 252;
  --card: 30 41 59;
  --primary: 34 197 94;
  --secondary: 22 163 74;
  --muted: 148 163 184;
  --border: 51 65 85;
  --danger: 239 68 68;
  --warning: 251 191 36;
}
```

Interface rules:

* No gradients
* Maximum three card elevations
* 12–16px card radii
* Minimum 44px mobile touch targets
* Visible focus rings
* Skeleton loading states
* Empty states with clear actions
* Responsive data tables
* Reduced-motion support
* Keyboard-accessible dialogs and menus
* Semantic color usage

---

# 19. Dashboard Layout

Desktop:

```text
Sidebar
├── Overview
├── Properties
├── Units
├── Tenants
├── Leases
├── Payments
├── Reminders
├── Maintenance
├── Legal
├── Reports
└── Settings

Topbar
├── Organization switcher
├── Global search
├── Create button
├── Notifications
├── Theme toggle
└── Profile menu
```

Primary dashboard sections:

```text
Metric cards
Revenue chart
Rent collection progress
Occupancy chart
Upcoming due dates
Overdue tenants
Recent payments
Recent activity
Lease-expiry alerts
```

On mobile, use a five-item bottom navigation and place less-frequent modules inside a “More” screen.

---

# 20. Production Milestones

## Milestone 1 — Foundation

Deliverables:

* Monorepo
* Web, mobile, and API applications
* Shared packages
* Docker development environment
* PostgreSQL and Redis
* Prisma schema
* Firebase authentication
* Organization onboarding
* Role-based authorization
* UI design system
* Light and dark modes
* CI checks
* Environment validation
* Logging
* Error handling
* API documentation

## Milestone 2 — Property Operations

* Property CRUD
* Unit CRUD
* Image uploads
* Property detail pages
* Unit status management
* Search, filtering, and pagination

## Milestone 3 — Tenants and Leases

* Tenant records
* Lease creation
* Lease activation
* Rent schedule generation
* Lease expiry tracking
* Tenant documents

## Milestone 4 — Payments

* Manual payments
* Paystack
* Flutterwave
* Webhook processing
* Payment allocation
* Receipts
* Refunds
* Reconciliation jobs

## Milestone 5 — Communication

* Email
* Termii SMS
* Push notifications
* Reminder rules
* Message templates
* Delivery history

## Milestone 6 — Tenant Portal and Maintenance

* Tenant authentication
* Rent history
* Receipt downloads
* Maintenance requests
* Photos and comments
* Notifications

## Milestone 7 — Legal and Reports

* Templates
* Lease PDFs
* Notices
* Document versioning
* Expiry tracking
* Revenue reports
* Occupancy reports
* PDF, CSV, and Excel exports

## Milestone 8 — SaaS Administration

* Plans
* Subscriptions
* Entitlements
* Usage limits
* Admin analytics
* User suspension
* Audit logs

## Milestone 9 — Production Release

* End-to-end tests
* Security review
* Load testing
* Database backup verification
* Monitoring
* Error tracking
* Deployment pipelines
* App-store builds
* Production documentation

---

# 21. Recommended First Release Scope

A true MVP should include:

* Landlord registration and onboarding
* Organization and team management
* Property and unit management
* Tenant records
* Lease management
* Rent schedules
* Manual payment entry
* Paystack payment collection
* Dashboard metrics
* Email and SMS reminders
* PDF receipts
* Basic tenant portal
* Maintenance requests
* Basic reports
* Light and dark modes
* Responsive PWA
* Android and iOS mobile foundations

Defer these until after the first beta:

* Digital signatures
* WhatsApp messaging
* Advanced accounting
* Multiple payment currencies
* Automated bank-statement reconciliation
* AI document generation
* Marketplace features
* Complex agency commission accounting

## Final implementation decision

RentPilot should be built as a multi-tenant Turborepo containing:

```text
Next.js web PWA
Expo React Native mobile app
Express REST API
PostgreSQL with Prisma
Redis with BullMQ
Firebase Authentication
Paystack and Flutterwave adapters
Cloudinary document and image storage
Termii and Nodemailer messaging
```

This architecture preserves the requested product scope while removing the Next.js/React Router conflict, establishing secure tenant isolation, and providing a finance model capable of handling partial payments, arrears, refunds, and multiple rent periods.

[1]: https://nextjs.org/docs?utm_source=chatgpt.com "Next.js Docs | Next.js"
[2]: https://docs.expo.dev/?utm_source=chatgpt.com "Expo Documentation"
[3]: https://firebase.google.com/docs/auth/admin/verify-id-tokens?utm_source=chatgpt.com "Verify ID Tokens | Firebase Authentication - Google"
[4]: https://www.prisma.io/docs/postgres?utm_source=chatgpt.com "Overview | Prisma Postgres
