# RENTpilot Existing Repository Audit

## Status

Phase: 0 — Existing Repository Audit

This document records the state of RENTpilot before its migration into a
production-ready multi-tenant rental-property SaaS.

## Product Direction

RENTpilot is a long-term rental-property operating system for landlords,
property managers and tenants.

The core operational domain is:

Organisation → Properties → Units → Tenants → Leases → Rent

Supporting domains include:

- Maintenance
- Documents
- Notifications
- Expenses
- Receipts
- Audit logs
- Reporting

The marketplace is a secondary product surface and must not replace the core
property-management system.

## Existing Architecture

Pending verified repository analysis.

## Existing Frontend

Pending verified repository analysis.

## Existing Backend

Pending verified repository analysis.

## Existing Database

Pending verified repository analysis.

## Existing Authentication

Pending verified repository analysis.

## Existing Features

Pending verified repository analysis.

## Existing Tests

Pending verified repository analysis.

## Existing Deployment

Pending verified repository analysis.

## Reusable Components

Pending verified repository analysis.

## Technical Debt

Pending verified repository analysis.

## Security Findings

Pending verified repository analysis.

## Broken or Incomplete Functionality

Pending verified repository analysis.

## Recommended Architecture

Target architecture:

- Next.js / TypeScript web application
- Node.js / TypeScript REST API
- PostgreSQL
- Redis
- Background worker
- S3-compatible object storage
- Provider-independent email service
- Docker
- GitHub Actions
- Terraform for production infrastructure

## SaaS Boundary

Organisation is the primary tenant boundary.

Every organisation-owned business record must be protected by organisation
membership and server-side authorisation.

## MVP Priority

1. Authentication
2. Organisations and memberships
3. Properties
4. Units
5. Tenants
6. Leases
7. Rent tracking
8. Receipts
9. Dashboard
10. Overdue rent
11. Maintenance
12. Documents
13. Notifications
14. Audit logs

## Migration Principle

Preserve useful existing functionality.

Do not perform a blind rewrite.

Replace or migrate components only when the repository audit demonstrates a
clear security, maintainability, correctness, or product reason.

## Verified Baseline

The existing RENTpilot repository is an npm-workspace monorepo containing:

- apps/web — Next.js
- apps/api — Express + TypeScript
- packages/shared — shared TypeScript package

Baseline validation:

- API TypeScript: PASS
- Web TypeScript: PASS
- Shared TypeScript: PASS
- API build: PASS
- Web production build: PASS
- Shared build: PASS

The web production build currently reports a non-blocking metadataBase warning.

## Existing Authentication

Authentication uses Supabase Auth.

The Express API receives a Bearer access token and validates it server-side
using Supabase Auth before attaching the authenticated user ID/email to the
request.

This authentication mechanism will be retained for the MVP.

## Existing Database Architecture

The existing PostgreSQL/Supabase schema contains:

- profiles
- properties
- tenancies
- rent_records
- complaints
- subscriptions

The existing model primarily scopes data directly using landlord_id and
tenant_id.

## Architecture Finding

The existing user-centric ownership model is insufficient for a true
multi-tenant SaaS.

The target tenant boundary is Organisation.

OrganisationMember will connect users to organisations with scoped roles.

Organisation-owned business records will be authorised using organisation_id.

## Security Findings

1. The Supabase service-role client is used by the API.

   Because service-role database access bypasses RLS, Express/API-level
   authorisation is mandatory for every organisation-owned resource.

2. POST /rent-records currently inserts req.body directly.

   Financial records must instead use explicit validation and server-derived
   organisation/ownership fields.

3. PATCH /rent-records/:id currently scopes the mutation only by record ID.

   Future financial mutations must additionally validate organisation
   ownership and appropriate permissions.

4. The repository previously tracked .env.

   The file has been removed from Git tracking and is now ignored.
   Any previously committed production secret must be rotated.

## Migration Strategy

RENTpilot will use an additive migration strategy.

The legacy tables will remain temporarily while the application migrates to:

- organisations
- organisation_members
- organisation_invitations
- units
- tenants
- leases
- rent_charges
- rent_payments
- receipts
- audit_logs

Existing properties will be backfilled into organisations.

Legacy tenancies and rent_records will be retired only after their replacement
APIs and data migrations have been validated.
