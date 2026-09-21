-- =========================================================
-- RENTpilot
-- Migration 008: Organisation-aware maintenance management
-- =========================================================

begin;

-- ---------------------------------------------------------
-- Maintenance requests
-- ---------------------------------------------------------

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete restrict,

  property_id uuid not null
    references public.properties(id)
    on delete restrict,

  unit_id uuid
    references public.units(id)
    on delete set null,

  tenant_id uuid
    references public.tenants(id)
    on delete set null,

  title text not null,
  description text not null,

  category text not null default 'OTHER'
    check (
      category in (
        'PLUMBING',
        'ELECTRICAL',
        'WATER',
        'SECURITY',
        'APPLIANCE',
        'STRUCTURAL',
        'CLEANING',
        'OTHER'
      )
    ),

  priority text not null default 'NORMAL'
    check (
      priority in (
        'LOW',
        'NORMAL',
        'HIGH',
        'URGENT'
      )
    ),

  status text not null default 'OPEN'
    check (
      status in (
        'OPEN',
        'IN_PROGRESS',
        'WAITING',
        'RESOLVED',
        'CANCELLED'
      )
    ),

  reported_by uuid
    references public.profiles(id)
    on delete set null,

  assigned_to uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  resolution_notes text,

  resolved_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint maintenance_title_length
    check (
      char_length(trim(title))
      between 3 and 200
    ),

  constraint maintenance_description_length
    check (
      char_length(trim(description))
      between 3 and 5000
    )
);


-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------

create index if not exists maintenance_requests_org_idx
  on public.maintenance_requests(organisation_id);

create index if not exists maintenance_requests_property_idx
  on public.maintenance_requests(property_id);

create index if not exists maintenance_requests_unit_idx
  on public.maintenance_requests(unit_id)
  where unit_id is not null;

create index if not exists maintenance_requests_tenant_idx
  on public.maintenance_requests(tenant_id)
  where tenant_id is not null;

create index if not exists maintenance_requests_status_idx
  on public.maintenance_requests(
    organisation_id,
    status,
    created_at desc
  );

create index if not exists maintenance_requests_priority_idx
  on public.maintenance_requests(
    organisation_id,
    priority,
    created_at desc
  );

create index if not exists maintenance_requests_assigned_idx
  on public.maintenance_requests(
    organisation_id,
    assigned_to
  )
  where assigned_to is not null;


-- ---------------------------------------------------------
-- Validate organisation ownership
--
-- Prevents a service-role/API bug from connecting:
--   Organisation A
--      -> Property/Unit/Tenant from Organisation B
-- ---------------------------------------------------------

create or replace function
public.validate_maintenance_request_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  property_org uuid;
  unit_org uuid;
  unit_property uuid;
  tenant_org uuid;
begin

  select p.organisation_id
    into property_org
  from public.properties p
  where p.id = new.property_id;

  if property_org is null then
    raise exception
      'MAINTENANCE_PROPERTY_NOT_FOUND';
  end if;

  if property_org <> new.organisation_id then
    raise exception
      'MAINTENANCE_PROPERTY_ORGANISATION_MISMATCH';
  end if;


  if new.unit_id is not null then

    select
      u.organisation_id,
      u.property_id
      into
        unit_org,
        unit_property
    from public.units u
    where u.id = new.unit_id;

    if unit_org is null then
      raise exception
        'MAINTENANCE_UNIT_NOT_FOUND';
    end if;

    if unit_org <> new.organisation_id then
      raise exception
        'MAINTENANCE_UNIT_ORGANISATION_MISMATCH';
    end if;

    if unit_property <> new.property_id then
      raise exception
        'MAINTENANCE_UNIT_PROPERTY_MISMATCH';
    end if;

  end if;


  if new.tenant_id is not null then

    select t.organisation_id
      into tenant_org
    from public.tenants t
    where t.id = new.tenant_id;

    if tenant_org is null then
      raise exception
        'MAINTENANCE_TENANT_NOT_FOUND';
    end if;

    if tenant_org <> new.organisation_id then
      raise exception
        'MAINTENANCE_TENANT_ORGANISATION_MISMATCH';
    end if;

  end if;


  if new.assigned_to is not null
     and not exists (
       select 1
       from public.organisation_members om
       where om.organisation_id =
         new.organisation_id
         and om.user_id =
           new.assigned_to
         and om.is_active = true
     )
  then
    raise exception
      'MAINTENANCE_ASSIGNEE_NOT_ORGANISATION_MEMBER';
  end if;


  return new;
end;
$$;


drop trigger if exists
maintenance_requests_validate_scope
on public.maintenance_requests;

create trigger
maintenance_requests_validate_scope
before insert or update
on public.maintenance_requests
for each row
execute function
public.validate_maintenance_request_scope();


-- ---------------------------------------------------------
-- Status lifecycle
-- ---------------------------------------------------------

create or replace function
public.validate_maintenance_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if tg_op = 'INSERT' then

    if new.status = 'RESOLVED'
       and new.resolved_at is null
    then
      new.resolved_at = now();
    end if;

    return new;

  end if;


  if old.status = new.status then
    return new;
  end if;


  if old.status = 'OPEN'
     and new.status not in (
       'IN_PROGRESS',
       'WAITING',
       'RESOLVED',
       'CANCELLED'
     )
  then
    raise exception
      'INVALID_MAINTENANCE_STATUS_TRANSITION';

  elsif old.status = 'IN_PROGRESS'
     and new.status not in (
       'WAITING',
       'RESOLVED',
       'CANCELLED'
     )
  then
    raise exception
      'INVALID_MAINTENANCE_STATUS_TRANSITION';

  elsif old.status = 'WAITING'
     and new.status not in (
       'IN_PROGRESS',
       'RESOLVED',
       'CANCELLED'
     )
  then
    raise exception
      'INVALID_MAINTENANCE_STATUS_TRANSITION';

  elsif old.status in (
      'RESOLVED',
      'CANCELLED'
    )
  then
    raise exception
      'MAINTENANCE_REQUEST_ALREADY_CLOSED';

  end if;


  if new.status = 'RESOLVED' then
    new.resolved_at =
      coalesce(
        new.resolved_at,
        now()
      );
  else
    new.resolved_at = null;
  end if;


  return new;
end;
$$;


drop trigger if exists
maintenance_requests_status_transition
on public.maintenance_requests;

create trigger
maintenance_requests_status_transition
before insert or update of status
on public.maintenance_requests
for each row
execute function
public.validate_maintenance_status_transition();


-- ---------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------

drop trigger if exists
maintenance_requests_set_updated_at
on public.maintenance_requests;

create trigger
maintenance_requests_set_updated_at
before update
on public.maintenance_requests
for each row
execute function public.set_updated_at();


-- ---------------------------------------------------------
-- Audit trail
--
-- Uses existing RENTpilot audit_logs convention:
-- actor_id, organisation_id, action, resource_type,
-- resource_id, summary, metadata.
-- ---------------------------------------------------------

create or replace function
public.audit_maintenance_request_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_actor uuid;
  audit_action text;
  audit_summary text;
begin

  if tg_op = 'INSERT' then

    audit_actor :=
      coalesce(
        new.updated_by,
        new.reported_by
      );

    audit_action :=
      'MAINTENANCE_CREATED';

    audit_summary :=
      'Maintenance request created';

    insert into public.audit_logs (
      organisation_id,
      actor_id,
      action,
      resource_type,
      resource_id,
      summary,
      metadata
    )
    values (
      new.organisation_id,
      audit_actor,
      audit_action,
      'maintenance_request',
      new.id,
      audit_summary,
      jsonb_build_object(
        'property_id',
          new.property_id,
        'unit_id',
          new.unit_id,
        'tenant_id',
          new.tenant_id,
        'category',
          new.category,
        'priority',
          new.priority,
        'status',
          new.status
      )
    );

    return new;

  end if;


  audit_actor :=
    new.updated_by;


  if old.status is distinct from new.status then

    audit_action :=
      'MAINTENANCE_STATUS_CHANGED';

    audit_summary :=
      'Maintenance request status changed';

  else

    audit_action :=
      'MAINTENANCE_UPDATED';

    audit_summary :=
      'Maintenance request updated';

  end if;


  insert into public.audit_logs (
    organisation_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    summary,
    metadata
  )
  values (
    new.organisation_id,
    audit_actor,
    audit_action,
    'maintenance_request',
    new.id,
    audit_summary,
    jsonb_build_object(
      'old_status',
        old.status,
      'new_status',
        new.status,
      'priority',
        new.priority,
      'assigned_to',
        new.assigned_to,
      'resolved_at',
        new.resolved_at
    )
  );


  return new;
end;
$$;


drop trigger if exists
maintenance_requests_audit
on public.maintenance_requests;

create trigger
maintenance_requests_audit
after insert or update
on public.maintenance_requests
for each row
execute function
public.audit_maintenance_request_changes();


-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

alter table public.maintenance_requests
  enable row level security;


drop policy if exists
"organisation members read maintenance"
on public.maintenance_requests;

create policy
"organisation members read maintenance"
on public.maintenance_requests
for select
to authenticated
using (
  public.is_organisation_member(
    organisation_id
  )
);


drop policy if exists
"organisation members create maintenance"
on public.maintenance_requests;

create policy
"organisation members create maintenance"
on public.maintenance_requests
for insert
to authenticated
with check (
  public.is_organisation_member(
    organisation_id
  )
);


drop policy if exists
"organisation members update maintenance"
on public.maintenance_requests;

create policy
"organisation members update maintenance"
on public.maintenance_requests
for update
to authenticated
using (
  public.is_organisation_member(
    organisation_id
  )
)
with check (
  public.is_organisation_member(
    organisation_id
  )
);


-- ---------------------------------------------------------
-- Permissions
--
-- API currently uses the Supabase secret/service client.
-- These grants prepare for future authenticated direct
-- access while RLS remains the enforcement layer.
-- ---------------------------------------------------------

revoke all
on public.maintenance_requests
from anon;

grant select, insert, update
on public.maintenance_requests
to authenticated;


commit;
