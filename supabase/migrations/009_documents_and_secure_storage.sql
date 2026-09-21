-- =========================================================
-- RENTpilot
-- Migration 009: Documents and secure storage foundation
-- =========================================================

begin;

-- ---------------------------------------------------------
-- Private document bucket
--
-- Files remain private. Application access is provided
-- through short-lived signed upload/download URLs.
-- ---------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'rentpilot-documents',
  'rentpilot-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------
-- Organisation-aware document registry
-- ---------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete restrict,

  property_id uuid
    references public.properties(id)
    on delete set null,

  unit_id uuid
    references public.units(id)
    on delete set null,

  tenant_id uuid
    references public.tenants(id)
    on delete set null,

  lease_id uuid
    references public.leases(id)
    on delete set null,

  maintenance_id uuid
    references public.maintenance_requests(id)
    on delete set null,

  receipt_id uuid
    references public.receipts(id)
    on delete set null,

  document_type text not null
    check (
      document_type in (
        'PROPERTY',
        'TENANT',
        'LEASE',
        'MAINTENANCE',
        'RECEIPT',
        'OTHER'
      )
    ),

  title text not null,

  description text,

  file_name text not null,

  mime_type text not null,

  file_size bigint not null,

  storage_bucket text not null
    default 'rentpilot-documents',

  storage_key text not null,

  status text not null
    default 'PENDING_UPLOAD'
    check (
      status in (
        'PENDING_UPLOAD',
        'ACTIVE',
        'ARCHIVED',
        'DELETED'
      )
    ),

  uploaded_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  uploaded_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint documents_title_length
    check (
      char_length(trim(title))
      between 1 and 200
    ),

  constraint documents_file_name_length
    check (
      char_length(trim(file_name))
      between 1 and 255
    ),

  constraint documents_description_length
    check (
      description is null
      or char_length(description) <= 5000
    ),

  constraint documents_file_size
    check (
      file_size > 0
      and file_size <= 10485760
    ),

  constraint documents_storage_bucket
    check (
      storage_bucket =
        'rentpilot-documents'
    ),

  constraint documents_mime_type
    check (
      mime_type in (
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ),

  constraint documents_storage_key_unique
    unique (storage_key)
);


-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------

create index if not exists documents_org_created_idx
  on public.documents(
    organisation_id,
    created_at desc
  );

create index if not exists documents_property_idx
  on public.documents(property_id)
  where property_id is not null;

create index if not exists documents_unit_idx
  on public.documents(unit_id)
  where unit_id is not null;

create index if not exists documents_tenant_idx
  on public.documents(tenant_id)
  where tenant_id is not null;

create index if not exists documents_lease_idx
  on public.documents(lease_id)
  where lease_id is not null;

create index if not exists documents_maintenance_idx
  on public.documents(maintenance_id)
  where maintenance_id is not null;

create index if not exists documents_receipt_idx
  on public.documents(receipt_id)
  where receipt_id is not null;

create index if not exists documents_status_idx
  on public.documents(
    organisation_id,
    status,
    created_at desc
  );


-- ---------------------------------------------------------
-- Validate document organisation and resource scope
-- ---------------------------------------------------------

create or replace function
public.validate_document_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_org uuid;
  related_property uuid;
begin

  -- Storage bucket is application controlled.
  if new.storage_bucket <>
     'rentpilot-documents'
  then
    raise exception
      'DOCUMENT_INVALID_STORAGE_BUCKET';
  end if;


  -- Every object must live beneath its organisation prefix.
  if new.storage_key not like
     new.organisation_id::text || '/%'
  then
    raise exception
      'DOCUMENT_STORAGE_KEY_ORGANISATION_MISMATCH';
  end if;


  -- Property
  if new.property_id is not null then

    select p.organisation_id
      into related_org
    from public.properties p
    where p.id = new.property_id;

    if related_org is null then
      raise exception
        'DOCUMENT_PROPERTY_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_PROPERTY_ORGANISATION_MISMATCH';
    end if;

  end if;


  -- Unit
  if new.unit_id is not null then

    select
      u.organisation_id,
      u.property_id
      into
        related_org,
        related_property
    from public.units u
    where u.id = new.unit_id;

    if related_org is null then
      raise exception
        'DOCUMENT_UNIT_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_UNIT_ORGANISATION_MISMATCH';
    end if;

    if new.property_id is not null
       and related_property <>
           new.property_id
    then
      raise exception
        'DOCUMENT_UNIT_PROPERTY_MISMATCH';
    end if;

  end if;


  -- Tenant
  if new.tenant_id is not null then

    select t.organisation_id
      into related_org
    from public.tenants t
    where t.id = new.tenant_id;

    if related_org is null then
      raise exception
        'DOCUMENT_TENANT_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_TENANT_ORGANISATION_MISMATCH';
    end if;

  end if;


  -- Lease
  if new.lease_id is not null then

    select l.organisation_id
      into related_org
    from public.leases l
    where l.id = new.lease_id;

    if related_org is null then
      raise exception
        'DOCUMENT_LEASE_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_LEASE_ORGANISATION_MISMATCH';
    end if;

  end if;


  -- Maintenance
  if new.maintenance_id is not null then

    select m.organisation_id
      into related_org
    from public.maintenance_requests m
    where m.id = new.maintenance_id;

    if related_org is null then
      raise exception
        'DOCUMENT_MAINTENANCE_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_MAINTENANCE_ORGANISATION_MISMATCH';
    end if;

  end if;


  -- Receipt
  if new.receipt_id is not null then

    select r.organisation_id
      into related_org
    from public.receipts r
    where r.id = new.receipt_id;

    if related_org is null then
      raise exception
        'DOCUMENT_RECEIPT_NOT_FOUND';
    end if;

    if related_org <>
       new.organisation_id
    then
      raise exception
        'DOCUMENT_RECEIPT_ORGANISATION_MISMATCH';
    end if;

  end if;


  -- -------------------------------------------------------
  -- Require the appropriate relation for typed documents.
  -- OTHER may be organisation-level.
  -- -------------------------------------------------------

  if new.document_type = 'PROPERTY'
     and new.property_id is null
  then
    raise exception
      'DOCUMENT_PROPERTY_REQUIRED';

  elsif new.document_type = 'TENANT'
        and new.tenant_id is null
  then
    raise exception
      'DOCUMENT_TENANT_REQUIRED';

  elsif new.document_type = 'LEASE'
        and new.lease_id is null
  then
    raise exception
      'DOCUMENT_LEASE_REQUIRED';

  elsif new.document_type = 'MAINTENANCE'
        and new.maintenance_id is null
  then
    raise exception
      'DOCUMENT_MAINTENANCE_REQUIRED';

  elsif new.document_type = 'RECEIPT'
        and new.receipt_id is null
  then
    raise exception
      'DOCUMENT_RECEIPT_REQUIRED';

  end if;


  return new;
end;
$$;


drop trigger if exists
documents_validate_scope
on public.documents;

create trigger
documents_validate_scope
before insert or update
on public.documents
for each row
execute function
public.validate_document_scope();


-- ---------------------------------------------------------
-- uploaded_at lifecycle
-- ---------------------------------------------------------

create or replace function
public.sync_document_upload_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin

  if new.status = 'ACTIVE'
     and old.status is distinct from 'ACTIVE'
  then
    new.uploaded_at =
      coalesce(
        new.uploaded_at,
        now()
      );
  end if;


  if tg_op = 'UPDATE'
     and old.status in (
       'ARCHIVED',
       'DELETED'
     )
     and new.status <>
         old.status
  then
    raise exception
      'DOCUMENT_CLOSED';
  end if;


  return new;
end;
$$;


drop trigger if exists
documents_upload_status
on public.documents;

create trigger
documents_upload_status
before update of status
on public.documents
for each row
execute function
public.sync_document_upload_status();


-- ---------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------

drop trigger if exists
documents_set_updated_at
on public.documents;

create trigger
documents_set_updated_at
before update
on public.documents
for each row
execute function
public.set_updated_at();


-- ---------------------------------------------------------
-- Audit documents
-- ---------------------------------------------------------

create or replace function
public.audit_document_changes()
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
        new.uploaded_by
      );

    audit_action :=
      'DOCUMENT_UPLOAD_INITIATED';

    audit_summary :=
      'Document upload initiated';

  else

    audit_actor :=
      new.updated_by;

    if old.status is distinct from
       new.status
    then

      if new.status = 'ACTIVE' then
        audit_action :=
          'DOCUMENT_UPLOAD_COMPLETED';

        audit_summary :=
          'Document upload completed';

      elsif new.status = 'ARCHIVED' then
        audit_action :=
          'DOCUMENT_ARCHIVED';

        audit_summary :=
          'Document archived';

      elsif new.status = 'DELETED' then
        audit_action :=
          'DOCUMENT_DELETED';

        audit_summary :=
          'Document deleted';

      else
        audit_action :=
          'DOCUMENT_STATUS_CHANGED';

        audit_summary :=
          'Document status changed';
      end if;

    else
      audit_action :=
        'DOCUMENT_UPDATED';

      audit_summary :=
        'Document metadata updated';
    end if;

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
    'document',
    new.id,
    audit_summary,
    jsonb_build_object(
      'document_type',
        new.document_type,
      'file_name',
        new.file_name,
      'mime_type',
        new.mime_type,
      'file_size',
        new.file_size,
      'status',
        new.status,
      'property_id',
        new.property_id,
      'tenant_id',
        new.tenant_id,
      'lease_id',
        new.lease_id,
      'maintenance_id',
        new.maintenance_id,
      'receipt_id',
        new.receipt_id
    )
  );


  return new;
end;
$$;


drop trigger if exists
documents_audit
on public.documents;

create trigger
documents_audit
after insert or update
on public.documents
for each row
execute function
public.audit_document_changes();


-- ---------------------------------------------------------
-- Row Level Security
--
-- The browser may read document metadata through future
-- authenticated direct access.
--
-- Direct table writes are intentionally not granted.
-- Upload mutations go through the trusted API.
-- ---------------------------------------------------------

alter table public.documents
  enable row level security;


drop policy if exists
"organisation members read documents"
on public.documents;

create policy
"organisation members read documents"
on public.documents
for select
to authenticated
using (
  public.is_organisation_member(
    organisation_id
  )
);


revoke all
on public.documents
from anon;

revoke insert, update, delete
on public.documents
from authenticated;

grant select
on public.documents
to authenticated;


commit;
