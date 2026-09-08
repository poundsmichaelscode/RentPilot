begin;

-- =========================================================
-- RENTpilot Phase 1A
-- Organisation-aware SaaS foundation
--
-- This migration intentionally preserves the existing:
--   profiles
--   properties
--   tenancies
--   rent_records
--   complaints
--   subscriptions
--
-- They will be migrated incrementally rather than deleted.
-- =========================================================


-- ---------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),

  name text not null
    check (char_length(trim(name)) between 2 and 120),

  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),

  country_code char(2) not null default 'NG',
  default_currency char(3) not null default 'NGN',
  timezone text not null default 'Africa/Lagos',

  status text not null default 'active'
    check (status in ('active', 'suspended', 'inactive')),

  created_by uuid references public.profiles(id) on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- Organisation memberships
-- ---------------------------------------------------------

create table if not exists public.organisation_members (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  role text not null
    check (
      role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER',
        'ACCOUNTANT',
        'STAFF'
      )
    ),

  is_active boolean not null default true,

  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (organisation_id, user_id)
);


create index if not exists organisation_members_user_idx
  on public.organisation_members(user_id);

create index if not exists organisation_members_org_idx
  on public.organisation_members(organisation_id);


-- ---------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------

create table if not exists public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  email text not null,

  role text not null
    check (
      role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER',
        'ACCOUNTANT',
        'STAFF'
      )
    ),

  token_hash text not null unique,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'revoked',
        'expired'
      )
    ),

  invited_by uuid not null
    references public.profiles(id)
    on delete restrict,

  expires_at timestamptz not null,
  accepted_at timestamptz,

  created_at timestamptz not null default now()
);


create index if not exists organisation_invitations_org_idx
  on public.organisation_invitations(organisation_id);

create index if not exists organisation_invitations_email_idx
  on public.organisation_invitations(lower(email));


-- ---------------------------------------------------------
-- Backfill organisations for existing landlords
-- ---------------------------------------------------------

insert into public.organisations (
  name,
  slug,
  created_by
)
select
  case
    when trim(coalesce(p.full_name, '')) <> ''
      then trim(p.full_name) || ' Properties'
    else split_part(p.email, '@', 1) || ' Properties'
  end,

  'org-' || left(replace(p.id::text, '-', ''), 20),

  p.id
from public.profiles p
where p.role::text = 'landlord'
and not exists (
  select 1
  from public.organisations o
  where o.created_by = p.id
);


-- ---------------------------------------------------------
-- Existing landlords become organisation owners
-- ---------------------------------------------------------

insert into public.organisation_members (
  organisation_id,
  user_id,
  role
)
select
  o.id,
  o.created_by,
  'OWNER'
from public.organisations o
where o.created_by is not null
on conflict (organisation_id, user_id) do nothing;


-- ---------------------------------------------------------
-- Upgrade existing properties
-- ---------------------------------------------------------

alter table public.properties
  add column if not exists organisation_id uuid;

alter table public.properties
  add column if not exists property_type text;

alter table public.properties
  add column if not exists city text;

alter table public.properties
  add column if not exists state text;

alter table public.properties
  add column if not exists country text not null default 'Nigeria';

alter table public.properties
  add column if not exists description text;

alter table public.properties
  add column if not exists amenities text[] not null default '{}';

alter table public.properties
  add column if not exists status text not null default 'active';

alter table public.properties
  add column if not exists updated_at timestamptz not null default now();


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_organisation_fk'
  ) then
    alter table public.properties
      add constraint properties_organisation_fk
      foreign key (organisation_id)
      references public.organisations(id)
      on delete restrict;
  end if;
end
$$;


update public.properties p
set organisation_id = o.id
from public.organisations o
where o.created_by = p.landlord_id
and p.organisation_id is null;


create index if not exists properties_organisation_idx
  on public.properties(organisation_id);


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_id_organisation_unique'
  ) then
    alter table public.properties
      add constraint properties_id_organisation_unique
      unique (id, organisation_id);
  end if;
end
$$;


-- ---------------------------------------------------------
-- Units
-- ---------------------------------------------------------

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null,

  property_id uuid not null,

  unit_number text not null,

  unit_type text,

  bedrooms smallint
    check (bedrooms is null or bedrooms >= 0),

  bathrooms numeric(4,1)
    check (bathrooms is null or bathrooms >= 0),

  floor text,

  monthly_rent numeric(14,2) not null
    check (monthly_rent >= 0),

  security_deposit numeric(14,2) not null default 0
    check (security_deposit >= 0),

  status text not null default 'VACANT'
    check (
      status in (
        'VACANT',
        'OCCUPIED',
        'RESERVED',
        'MAINTENANCE',
        'INACTIVE'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (property_id, unit_number),

  foreign key (property_id, organisation_id)
    references public.properties(id, organisation_id)
    on delete cascade
);


create index if not exists units_organisation_idx
  on public.units(organisation_id);

create index if not exists units_property_idx
  on public.units(property_id);

create index if not exists units_status_idx
  on public.units(organisation_id, status);


create unique index if not exists units_id_organisation_uidx
  on public.units(id, organisation_id);


-- ---------------------------------------------------------
-- Tenants
--
-- Tenant is a business/domain record.
-- profile_id is optional so a landlord can add a tenant
-- before that tenant creates a RENTpilot account.
-- ---------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  profile_id uuid
    references public.profiles(id)
    on delete set null,

  full_name text not null
    check (char_length(trim(full_name)) >= 2),

  email text,
  phone text,

  emergency_contact_name text,
  emergency_contact_phone text,

  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'INACTIVE')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create index if not exists tenants_organisation_idx
  on public.tenants(organisation_id);

create index if not exists tenants_profile_idx
  on public.tenants(profile_id);

create unique index if not exists tenants_org_email_uidx
  on public.tenants(organisation_id, lower(email))
  where email is not null;


create unique index if not exists tenants_id_organisation_uidx
  on public.tenants(id, organisation_id);


-- ---------------------------------------------------------
-- Leases
-- ---------------------------------------------------------

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null,

  unit_id uuid not null,

  tenant_id uuid not null,

  start_date date not null,
  end_date date not null,

  rent_amount numeric(14,2) not null
    check (rent_amount >= 0),

  payment_frequency text not null default 'ANNUAL'
    check (
      payment_frequency in (
        'MONTHLY',
        'QUARTERLY',
        'BIANNUAL',
        'ANNUAL',
        'CUSTOM'
      )
    ),

  security_deposit numeric(14,2) not null default 0
    check (security_deposit >= 0),

  grace_period_days integer not null default 0
    check (grace_period_days between 0 and 90),

  late_fee numeric(14,2) not null default 0
    check (late_fee >= 0),

  status text not null default 'ACTIVE'
    check (
      status in (
        'DRAFT',
        'ACTIVE',
        'EXPIRING_SOON',
        'EXPIRED',
        'RENEWED',
        'TERMINATED'
      )
    ),

  lease_document_key text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_date > start_date),

  foreign key (unit_id, organisation_id)
    references public.units(id, organisation_id)
    on delete restrict,

  foreign key (tenant_id, organisation_id)
    references public.tenants(id, organisation_id)
    on delete restrict
);


create index if not exists leases_organisation_idx
  on public.leases(organisation_id);

create index if not exists leases_unit_idx
  on public.leases(unit_id);

create index if not exists leases_tenant_idx
  on public.leases(tenant_id);

create index if not exists leases_end_date_idx
  on public.leases(organisation_id, end_date);

create index if not exists leases_status_idx
  on public.leases(organisation_id, status);


create unique index if not exists leases_id_organisation_uidx
  on public.leases(id, organisation_id);


-- ---------------------------------------------------------
-- Rent charges
--
-- Represents what is expected/due.
-- Payments are stored separately.
-- ---------------------------------------------------------

create table if not exists public.rent_charges (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null,

  lease_id uuid not null,

  period_start date not null,
  period_end date not null,
  due_date date not null,

  expected_amount numeric(14,2) not null
    check (expected_amount >= 0),

  waived_amount numeric(14,2) not null default 0
    check (waived_amount >= 0),

  status text not null default 'PENDING'
    check (
      status in (
        'PENDING',
        'PARTIALLY_PAID',
        'PAID',
        'OVERDUE',
        'WAIVED'
      )
    ),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (period_end >= period_start),
  check (waived_amount <= expected_amount),

  unique (lease_id, period_start, period_end),

  foreign key (lease_id, organisation_id)
    references public.leases(id, organisation_id)
    on delete restrict
);


create index if not exists rent_charges_organisation_idx
  on public.rent_charges(organisation_id);

create index if not exists rent_charges_due_idx
  on public.rent_charges(organisation_id, due_date);

create index if not exists rent_charges_status_idx
  on public.rent_charges(organisation_id, status);


create unique index if not exists rent_charges_id_organisation_uidx
  on public.rent_charges(id, organisation_id);


-- ---------------------------------------------------------
-- Rent payments
-- ---------------------------------------------------------

create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null,

  lease_id uuid not null,

  rent_charge_id uuid,

  amount numeric(14,2) not null
    check (amount > 0),

  payment_date date not null,

  payment_method text not null
    check (
      payment_method in (
        'BANK_TRANSFER',
        'CASH',
        'CARD',
        'POS',
        'CHEQUE',
        'OTHER'
      )
    ),

  reference text,
  notes text,

  recorded_by uuid
    references public.profiles(id)
    on delete set null,

  idempotency_key text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (lease_id, organisation_id)
    references public.leases(id, organisation_id)
    on delete restrict,

  foreign key (rent_charge_id, organisation_id)
    references public.rent_charges(id, organisation_id)
    on delete restrict
);


create index if not exists rent_payments_organisation_idx
  on public.rent_payments(organisation_id);

create index if not exists rent_payments_lease_idx
  on public.rent_payments(lease_id);

create index if not exists rent_payments_charge_idx
  on public.rent_payments(rent_charge_id);

create index if not exists rent_payments_date_idx
  on public.rent_payments(organisation_id, payment_date desc);


create unique index if not exists rent_payments_idempotency_uidx
  on public.rent_payments(organisation_id, idempotency_key)
  where idempotency_key is not null;


-- ---------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete restrict,

  payment_id uuid not null unique
    references public.rent_payments(id)
    on delete restrict,

  receipt_number text not null,

  storage_key text,

  status text not null default 'ISSUED'
    check (status in ('ISSUED', 'VOID')),

  issued_by uuid
    references public.profiles(id)
    on delete set null,

  issued_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  unique (organisation_id, receipt_number)
);


create index if not exists receipts_organisation_idx
  on public.receipts(organisation_id);


-- ---------------------------------------------------------
-- Immutable audit log
-- ---------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete restrict,

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,
  resource_type text not null,
  resource_id uuid,

  summary text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists audit_logs_org_created_idx
  on public.audit_logs(organisation_id, created_at desc);

create index if not exists audit_logs_resource_idx
  on public.audit_logs(resource_type, resource_id);


-- ---------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists organisations_set_updated_at
  on public.organisations;

create trigger organisations_set_updated_at
before update on public.organisations
for each row execute function public.set_updated_at();


drop trigger if exists properties_set_updated_at
  on public.properties;

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();


drop trigger if exists units_set_updated_at
  on public.units;

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();


drop trigger if exists tenants_set_updated_at
  on public.tenants;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();


drop trigger if exists leases_set_updated_at
  on public.leases;

create trigger leases_set_updated_at
before update on public.leases
for each row execute function public.set_updated_at();


drop trigger if exists rent_charges_set_updated_at
  on public.rent_charges;

create trigger rent_charges_set_updated_at
before update on public.rent_charges
for each row execute function public.set_updated_at();


drop trigger if exists rent_payments_set_updated_at
  on public.rent_payments;

create trigger rent_payments_set_updated_at
before update on public.rent_payments
for each row execute function public.set_updated_at();


-- ---------------------------------------------------------
-- Organisation membership helper for RLS
--
-- NOTE:
-- The Express API currently uses the Supabase service-role
-- client. Service-role access bypasses RLS.
--
-- These policies are defense in depth for future direct
-- authenticated client access. API-level organisation
-- authorization is still mandatory.
-- ---------------------------------------------------------

create or replace function public.is_organisation_member(
  target_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = target_organisation_id
      and om.user_id = auth.uid()
      and om.is_active = true
  );
$$;


grant execute
on function public.is_organisation_member(uuid)
to authenticated;


-- ---------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------

alter table public.organisations
  enable row level security;

alter table public.organisation_members
  enable row level security;

alter table public.organisation_invitations
  enable row level security;

alter table public.units
  enable row level security;

alter table public.tenants
  enable row level security;

alter table public.leases
  enable row level security;

alter table public.rent_charges
  enable row level security;

alter table public.rent_payments
  enable row level security;

alter table public.receipts
  enable row level security;

alter table public.audit_logs
  enable row level security;


-- ---------------------------------------------------------
-- Read policies
--
-- Writes remain server/API controlled.
-- ---------------------------------------------------------

drop policy if exists "members read organisations"
on public.organisations;

create policy "members read organisations"
on public.organisations
for select
using (
  public.is_organisation_member(id)
);


drop policy if exists "members read memberships"
on public.organisation_members;

create policy "members read memberships"
on public.organisation_members
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read organisation invitations"
on public.organisation_invitations;

create policy "members read organisation invitations"
on public.organisation_invitations
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read units"
on public.units;

create policy "members read units"
on public.units
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read tenants"
on public.tenants;

create policy "members read tenants"
on public.tenants
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read leases"
on public.leases;

create policy "members read leases"
on public.leases
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read rent charges"
on public.rent_charges;

create policy "members read rent charges"
on public.rent_charges
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read rent payments"
on public.rent_payments;

create policy "members read rent payments"
on public.rent_payments
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read receipts"
on public.receipts;

create policy "members read receipts"
on public.receipts
for select
using (
  public.is_organisation_member(organisation_id)
);


drop policy if exists "members read audit logs"
on public.audit_logs;

create policy "members read audit logs"
on public.audit_logs
for select
using (
  public.is_organisation_member(organisation_id)
);


-- ---------------------------------------------------------
-- Organisation-aware read policy for legacy properties
-- while preserving existing marketplace/owner policies.
-- ---------------------------------------------------------

drop policy if exists "organisation members read properties"
on public.properties;

create policy "organisation members read properties"
on public.properties
for select
using (
  organisation_id is not null
  and public.is_organisation_member(organisation_id)
);


commit;
