-- =========================================================
-- RENTpilot Phase 2D
-- Controlled marketplace publishing
-- =========================================================

create or replace function
public.set_property_marketplace_publishing(
  p_user_id uuid,
  p_organisation_id uuid,
  p_property_id uuid,
  p_is_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_property record;
  v_vacant_units integer;
begin

  -- -------------------------------------------------------
  -- Authorisation
  -- -------------------------------------------------------

  select
    om.role
  into
    v_role
  from public.organisation_members om
  where
    om.organisation_id =
      p_organisation_id
    and om.user_id =
      p_user_id
    and om.is_active =
      true;

  if v_role is null
     or v_role not in (
       'OWNER',
       'ADMIN',
       'PROPERTY_MANAGER'
     ) then
    raise exception
      'MARKETPLACE_PUBLISH_FORBIDDEN';
  end if;


  -- -------------------------------------------------------
  -- Lock property
  -- -------------------------------------------------------

  select
    p.id,
    p.name,
    p.status,
    p.is_published
  into
    v_property
  from public.properties p
  where
    p.id =
      p_property_id
    and p.organisation_id =
      p_organisation_id
  for update;


  if not found then
    raise exception
      'PROPERTY_NOT_FOUND';
  end if;


  -- -------------------------------------------------------
  -- Availability
  -- -------------------------------------------------------

  select
    count(*)::integer
  into
    v_vacant_units
  from public.units u
  where
    u.organisation_id =
      p_organisation_id
    and u.property_id =
      p_property_id
    and u.status =
      'VACANT';


  if p_is_published then

    if v_property.status <>
       'active' then

      raise exception
        'MARKETPLACE_PROPERTY_NOT_ACTIVE';

    end if;


    if v_vacant_units < 1 then

      raise exception
        'MARKETPLACE_REQUIRES_VACANT_UNIT';

    end if;

  end if;


  -- -------------------------------------------------------
  -- Update property
  -- -------------------------------------------------------

  update public.properties
  set
    is_published =
      p_is_published,

    updated_at =
      now()

  where
    id =
      p_property_id

    and organisation_id =
      p_organisation_id;


  -- -------------------------------------------------------
  -- Audit trail
  -- -------------------------------------------------------

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

    case
      when p_is_published
        then 'PROPERTY_MARKETPLACE_PUBLISHED'
      else 'PROPERTY_MARKETPLACE_UNPUBLISHED'
    end,

    'property',
    p_property_id,

    case
      when p_is_published
        then 'Property published to marketplace'
      else 'Property removed from marketplace'
    end,

    jsonb_build_object(
      'property_name',
      v_property.name,

      'is_published',
      p_is_published,

      'vacant_units',
      v_vacant_units
    )
  );


  return jsonb_build_object(
    'propertyId',
    p_property_id,

    'isPublished',
    p_is_published,

    'availableUnits',
    v_vacant_units
  );

end;
$$;


revoke all
on function
public.set_property_marketplace_publishing(
  uuid,
  uuid,
  uuid,
  boolean
)
from public;


revoke all
on function
public.set_property_marketplace_publishing(
  uuid,
  uuid,
  uuid,
  boolean
)
from anon;


revoke all
on function
public.set_property_marketplace_publishing(
  uuid,
  uuid,
  uuid,
  boolean
)
from authenticated;


grant execute
on function
public.set_property_marketplace_publishing(
  uuid,
  uuid,
  uuid,
  boolean
)
to service_role;


comment on function
public.set_property_marketplace_publishing(
  uuid,
  uuid,
  uuid,
  boolean
)
is
  'Publishes or removes an organisation property from the public marketplace with role validation, vacancy validation and audit logging.';
