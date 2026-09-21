begin;

-- =========================================================
-- RENTpilot Phase 1D
-- Atomic property + initial unit setup
-- =========================================================

create or replace function public.sync_property_unit_summary()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_property_id uuid;
  v_old_property_id uuid;
begin
  if tg_op = 'DELETE' then
    v_property_id := old.property_id;
  else
    v_property_id := new.property_id;
  end if;

  update public.properties p
  set
    units = (
      select count(*)::integer
      from public.units u
      where u.property_id = v_property_id
    ),
    monthly_rent = (
      select coalesce(sum(u.monthly_rent), 0)
      from public.units u
      where u.property_id = v_property_id
        and u.status <> 'INACTIVE'
    )
  where p.id = v_property_id;

  /*
   * Defensive handling in case a unit is ever moved
   * between properties administratively.
   */
  if tg_op = 'UPDATE' then
    v_old_property_id := old.property_id;

    if v_old_property_id is distinct from v_property_id then
      update public.properties p
      set
        units = (
          select count(*)::integer
          from public.units u
          where u.property_id = v_old_property_id
        ),
        monthly_rent = (
          select coalesce(sum(u.monthly_rent), 0)
          from public.units u
          where u.property_id = v_old_property_id
            and u.status <> 'INACTIVE'
        )
      where p.id = v_old_property_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


drop trigger if exists units_sync_property_summary
on public.units;

create trigger units_sync_property_summary
after insert or update or delete
on public.units
for each row
execute function public.sync_property_unit_summary();


create or replace function public.create_property_with_units(
  p_user_id uuid,
  p_organisation_id uuid,
  p_name text,
  p_address text,
  p_city text,
  p_state text,
  p_country text,
  p_property_type text,
  p_description text,
  p_amenities text[],
  p_units jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_unit_count integer;
  v_monthly_rent numeric(14,2);
begin
  /*
   * Database-level authorisation.
   * API role checks remain in place as another layer.
   */
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
    raise exception 'PROPERTY_SETUP_FORBIDDEN';
  end if;

  if trim(coalesce(p_name, '')) = '' then
    raise exception 'PROPERTY_NAME_REQUIRED';
  end if;

  if trim(coalesce(p_address, '')) = '' then
    raise exception 'PROPERTY_ADDRESS_REQUIRED';
  end if;

  if p_property_type is not null
    and p_property_type not in (
      'apartment_building',
      'house',
      'duplex',
      'block_of_flats',
      'commercial_property',
      'office',
      'shop',
      'warehouse',
      'mixed_use',
      'other'
    )
  then
    raise exception 'INVALID_PROPERTY_TYPE';
  end if;

  if p_units is null
    or jsonb_typeof(p_units) <> 'array'
    or jsonb_array_length(p_units) < 1
  then
    raise exception 'AT_LEAST_ONE_UNIT_REQUIRED';
  end if;

  v_unit_count :=
    jsonb_array_length(p_units);

  select
    coalesce(
      sum(
        (item ->> 'monthly_rent')::numeric
      ),
      0
    )
  into v_monthly_rent
  from jsonb_array_elements(p_units) item;

  /*
   * Keep legacy properties.units and monthly_rent
   * populated for compatibility.
   *
   * public.units remains the source of truth.
   */
  insert into public.properties (
    landlord_id,
    organisation_id,
    name,
    address,
    city,
    state,
    country,
    property_type,
    description,
    amenities,
    units,
    monthly_rent,
    images,
    is_published
  )
  values (
    p_user_id,
    p_organisation_id,
    trim(p_name),
    trim(p_address),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_state, '')), ''),
    coalesce(
      nullif(trim(p_country), ''),
      'Nigeria'
    ),
    p_property_type,
    nullif(
      trim(coalesce(p_description, '')),
      ''
    ),
    coalesce(
      p_amenities,
      array[]::text[]
    ),
    v_unit_count,
    v_monthly_rent,
    array[]::text[],
    false
  )
  returning id
  into v_property_id;

  insert into public.units (
    organisation_id,
    property_id,
    unit_number,
    unit_type,
    bedrooms,
    bathrooms,
    floor,
    monthly_rent,
    security_deposit,
    status
  )
  select
    p_organisation_id,
    v_property_id,
    trim(u.unit_number),
    nullif(trim(u.unit_type), ''),
    u.bedrooms,
    u.bathrooms,
    nullif(trim(coalesce(u.floor, '')), ''),
    u.monthly_rent,
    coalesce(u.security_deposit, 0),
    'VACANT'
  from jsonb_to_recordset(p_units)
    as u(
      unit_number text,
      unit_type text,
      bedrooms smallint,
      bathrooms numeric(4,1),
      floor text,
      monthly_rent numeric(14,2),
      security_deposit numeric(14,2)
    );

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
    'PROPERTY_CREATED',
    'property',
    v_property_id,
    trim(p_name) || ' was created',
    jsonb_build_object(
      'unit_count',
      v_unit_count,
      'source',
      'property_setup'
    )
  );

  return jsonb_build_object(
    'propertyId',
    v_property_id,
    'unitCount',
    v_unit_count
  );
end;
$$;


revoke all
on function public.create_property_with_units(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.create_property_with_units(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  jsonb
)
to service_role;

commit;
