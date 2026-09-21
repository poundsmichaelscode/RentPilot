begin;

-- =========================================================
-- RENTpilot Phase 1E
-- Transactional tenant + lease operations
-- =========================================================


-- ---------------------------------------------------------
-- Create tenant
-- ---------------------------------------------------------

create or replace function public.create_tenant_record(
  p_user_id uuid,
  p_organisation_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_emergency_contact_name text,
  p_emergency_contact_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_user_id
      and om.is_active = true
      and om.role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER'
      )
  ) then
    raise exception 'TENANT_CREATE_FORBIDDEN';
  end if;

  if char_length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'TENANT_NAME_REQUIRED';
  end if;

  insert into public.tenants (
    organisation_id,
    full_name,
    email,
    phone,
    emergency_contact_name,
    emergency_contact_phone
  )
  values (
    p_organisation_id,
    trim(p_full_name),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_emergency_contact_name, '')), ''),
    nullif(trim(coalesce(p_emergency_contact_phone, '')), '')
  )
  returning id
  into v_tenant_id;

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
    p_organisation_id,
    p_user_id,
    'TENANT_CREATED',
    'tenant',
    v_tenant_id,
    trim(p_full_name) || ' was added as a tenant',
    jsonb_build_object(
      'source',
      'tenant_management'
    )
  );

  return jsonb_build_object(
    'tenantId',
    v_tenant_id
  );
end;
$$;


revoke all
on function public.create_tenant_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.create_tenant_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
)
to service_role;


-- ---------------------------------------------------------
-- Create lease
-- ---------------------------------------------------------

create or replace function public.create_lease_record(
  p_user_id uuid,
  p_organisation_id uuid,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_start_date date,
  p_end_date date,
  p_rent_amount numeric,
  p_payment_frequency text,
  p_security_deposit numeric,
  p_grace_period_days integer,
  p_late_fee numeric,
  p_status text,
  p_lease_document_key text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease_id uuid;
  v_unit_status text;
  v_tenant_status text;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_user_id
      and om.is_active = true
      and om.role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER'
      )
  ) then
    raise exception 'LEASE_CREATE_FORBIDDEN';
  end if;

  select u.status
  into v_unit_status
  from public.units u
  where u.id = p_unit_id
    and u.organisation_id = p_organisation_id;

  if v_unit_status is null then
    raise exception 'UNIT_NOT_FOUND';
  end if;

  select t.status
  into v_tenant_status
  from public.tenants t
  where t.id = p_tenant_id
    and t.organisation_id = p_organisation_id;

  if v_tenant_status is null then
    raise exception 'TENANT_NOT_FOUND';
  end if;

  if v_tenant_status <> 'ACTIVE' then
    raise exception 'TENANT_INACTIVE';
  end if;

  if p_status not in ('DRAFT', 'ACTIVE') then
    raise exception 'INVALID_INITIAL_LEASE_STATUS';
  end if;

  if p_status = 'ACTIVE'
    and v_unit_status in ('MAINTENANCE', 'INACTIVE')
  then
    raise exception 'UNIT_NOT_AVAILABLE';
  end if;

  insert into public.leases (
    organisation_id,
    unit_id,
    tenant_id,
    start_date,
    end_date,
    rent_amount,
    payment_frequency,
    security_deposit,
    grace_period_days,
    late_fee,
    status,
    lease_document_key,
    notes
  )
  values (
    p_organisation_id,
    p_unit_id,
    p_tenant_id,
    p_start_date,
    p_end_date,
    p_rent_amount,
    p_payment_frequency,
    p_security_deposit,
    p_grace_period_days,
    p_late_fee,
    p_status,
    nullif(trim(coalesce(p_lease_document_key, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id
  into v_lease_id;

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
    p_organisation_id,
    p_user_id,
    'LEASE_CREATED',
    'lease',
    v_lease_id,
    'Lease was created',
    jsonb_build_object(
      'unit_id',
      p_unit_id,
      'tenant_id',
      p_tenant_id,
      'status',
      p_status,
      'start_date',
      p_start_date,
      'end_date',
      p_end_date
    )
  );

  return jsonb_build_object(
    'leaseId',
    v_lease_id
  );
end;
$$;


revoke all
on function public.create_lease_record(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  date,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.create_lease_record(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  date,
  numeric,
  text,
  numeric,
  integer,
  numeric,
  text,
  text,
  text
)
to service_role;


-- ---------------------------------------------------------
-- Lease status lifecycle
-- ---------------------------------------------------------

create or replace function public.change_lease_status(
  p_user_id uuid,
  p_organisation_id uuid,
  p_lease_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_end_date date;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_user_id
      and om.is_active = true
      and om.role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER'
      )
  ) then
    raise exception 'LEASE_UPDATE_FORBIDDEN';
  end if;

  select
    l.status,
    l.end_date
  into
    v_current_status,
    v_end_date
  from public.leases l
  where l.id = p_lease_id
    and l.organisation_id = p_organisation_id
  for update;

  if v_current_status is null then
    raise exception 'LEASE_NOT_FOUND';
  end if;

  if p_status = v_current_status then
    return jsonb_build_object(
      'leaseId',
      p_lease_id,
      'status',
      v_current_status,
      'changed',
      false
    );
  end if;

  if not (
    (
      v_current_status = 'DRAFT'
      and p_status in (
        'ACTIVE',
        'TERMINATED'
      )
    )
    or
    (
      v_current_status = 'ACTIVE'
      and p_status in (
        'EXPIRING_SOON',
        'EXPIRED',
        'RENEWED',
        'TERMINATED'
      )
    )
    or
    (
      v_current_status = 'EXPIRING_SOON'
      and p_status in (
        'ACTIVE',
        'EXPIRED',
        'RENEWED',
        'TERMINATED'
      )
    )
  ) then
    raise exception 'INVALID_LEASE_STATUS_TRANSITION';
  end if;

  if p_status = 'EXPIRED'
    and current_date <= v_end_date
  then
    raise exception 'LEASE_NOT_YET_EXPIRED';
  end if;

  update public.leases
  set status = p_status
  where id = p_lease_id
    and organisation_id = p_organisation_id;

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
    p_organisation_id,
    p_user_id,
    'LEASE_STATUS_CHANGED',
    'lease',
    p_lease_id,
    'Lease status changed from '
      || v_current_status
      || ' to '
      || p_status,
    jsonb_build_object(
      'from',
      v_current_status,
      'to',
      p_status
    )
  );

  return jsonb_build_object(
    'leaseId',
    p_lease_id,
    'status',
    p_status,
    'changed',
    true
  );
end;
$$;


revoke all
on function public.change_lease_status(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.change_lease_status(
  uuid,
  uuid,
  uuid,
  text
)
to service_role;


commit;
