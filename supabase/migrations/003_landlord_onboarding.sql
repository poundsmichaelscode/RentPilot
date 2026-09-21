begin;

-- =========================================================
-- RENTpilot Phase 1C
-- Atomic landlord onboarding
--
-- Creates/updates:
--   profile
--   organisation
--   OWNER membership
--
-- The function is retry-safe and serialises onboarding
-- per user to prevent duplicate workspaces from concurrent
-- requests.
-- =========================================================

create or replace function public.complete_landlord_onboarding(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_organisation_name text,
  p_country_code text default 'NG',
  p_default_currency text default 'NGN'
)
returns table (
  profile_id uuid,
  organisation_id uuid,
  membership_id uuid,
  organisation_name text,
  organisation_slug text,
  organisation_role text,
  created boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_membership_id uuid;
  v_org_name text;
  v_slug text;
  v_created boolean := false;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  if trim(coalesce(p_email, '')) = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'FULL_NAME_REQUIRED';
  end if;

  if char_length(trim(coalesce(p_organisation_name, ''))) < 2 then
    raise exception 'ORGANISATION_NAME_REQUIRED';
  end if;

  if upper(trim(coalesce(p_country_code, ''))) !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_COUNTRY_CODE';
  end if;

  if upper(trim(coalesce(p_default_currency, ''))) !~ '^[A-Z]{3}$' then
    raise exception 'INVALID_CURRENCY';
  end if;

  /*
   * Prevent concurrent onboarding requests for the same
   * authenticated user from creating duplicate organisations.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text, 0)
  );

  /*
   * Ensure the legacy profile exists because several current
   * tables still reference public.profiles.
   */
  insert into public.profiles (
    id,
    email,
    full_name,
    phone
  )
  values (
    p_user_id,
    lower(trim(p_email)),
    trim(p_full_name),
    trim(coalesce(p_phone, ''))
  )
  on conflict (id)
  do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone;

  /*
   * If onboarding was already completed, return the existing
   * OWNER workspace instead of creating another one.
   */
  select
    om.organisation_id,
    om.id,
    o.name,
    o.slug
  into
    v_org_id,
    v_membership_id,
    v_org_name,
    v_slug
  from public.organisation_members om
  join public.organisations o
    on o.id = om.organisation_id
  where om.user_id = p_user_id
    and om.role = 'OWNER'
    and om.is_active = true
    and o.status = 'active'
  order by om.created_at asc
  limit 1;

  if v_org_id is not null then
    return query
    select
      p_user_id,
      v_org_id,
      v_membership_id,
      v_org_name,
      v_slug,
      'OWNER'::text,
      false;

    return;
  end if;

  v_org_id := gen_random_uuid();
  v_org_name := trim(p_organisation_name);

  v_slug :=
    trim(
      both '-'
      from regexp_replace(
        lower(v_org_name),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    );

  if char_length(v_slug) < 3 then
    v_slug := 'rentpilot';
  end if;

  v_slug :=
    left(v_slug, 50)
    || '-'
    || left(replace(v_org_id::text, '-', ''), 8);

  insert into public.organisations (
    id,
    name,
    slug,
    country_code,
    default_currency,
    created_by
  )
  values (
    v_org_id,
    v_org_name,
    v_slug,
    upper(trim(p_country_code)),
    upper(trim(p_default_currency)),
    p_user_id
  );

  insert into public.organisation_members (
    organisation_id,
    user_id,
    role
  )
  values (
    v_org_id,
    p_user_id,
    'OWNER'
  )
  returning id
  into v_membership_id;

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
    v_org_id,
    p_user_id,
    'ORGANISATION_CREATED',
    'organisation',
    v_org_id,
    trim(p_full_name)
      || ' created '
      || v_org_name,
    jsonb_build_object(
      'source',
      'landlord_onboarding'
    )
  );

  v_created := true;

  return query
  select
    p_user_id,
    v_org_id,
    v_membership_id,
    v_org_name,
    v_slug,
    'OWNER'::text,
    v_created;
end;
$$;

revoke all
on function public.complete_landlord_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.complete_landlord_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
to service_role;

commit;
