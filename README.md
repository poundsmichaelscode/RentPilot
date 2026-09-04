# RentPilot

Production-style property and rent management monorepo for landlords and tenants.

## Structure

```text
apps/web        Next.js + React + TypeScript client
apps/api        Node.js + Express + TypeScript REST API
packages/shared Shared domain types and API contracts
supabase        PostgreSQL schema, RLS, indexes and storage
docker          Multi-stage production images
```

## Run locally

1. Create a free Supabase project and run `supabase/migrations/001_initial_schema.sql` in its SQL editor.
2. Copy `.env.example` to `.env` and enter your Supabase values.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`. API health: `http://localhost:4000/health`.

Alternatively run `docker compose up --build`.

Free deployment options: Vercel for `apps/web`, Render for `apps/api`, and Supabase for PostgreSQL, authentication, and file storage. Tenant accounts remain free. Landlords on the free plan can add two properties; premium landlords can add unlimited properties.

Never commit `.env` or a Supabase service-role key.
