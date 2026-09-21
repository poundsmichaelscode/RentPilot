begin;

-- =========================================================
-- RENTpilot Phase 1E
-- Lease integrity + unit occupancy synchronisation
-- =========================================================


-- ---------------------------------------------------------
-- Prevent overlapping live leases
--
-- ACTIVE and EXPIRING_SOON are treated as live leases.
--
-- pg_advisory_xact_lock serialises competing writes against
-- the same unit, making the check safe under concurrency.
-- ---------------------------------------------------------

create or replace function public.prevent_overlapping_live_leases()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status not in (
    'ACTIVE',
    'EXPIRING_SOON'
  ) then
    return new;
  end if;

  /*
   * Serialise lease writes per unit.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.unit_id::text,
      0
    )
  );

  if exists (
    select 1
    from public.leases l
    where l.organisation_id =
      new.organisation_id

      and l.unit_id =
        new.unit_id

      and l.id <>
        coalesce(
          new.id,
          gen_random_uuid()
        )

      and l.status in (
        'ACTIVE',
        'EXPIRING_SOON'
      )

      /*
       * Inclusive date ranges:
       *
       * existing: Jan 1 - Dec 31
       * new:      Dec 31 - next year
       *
       * conflicts because both include Dec 31.
       */
      and daterange(
        l.start_date,
        l.end_date,
        '[]'
      )
      &&
      daterange(
        new.start_date,
        new.end_date,
        '[]'
      )
  ) then
    raise exception
      using
        errcode = 'P0001',
        message = 'LEASE_DATE_CONFLICT',
        detail =
          'The unit already has an overlapping live lease.';
  end if;

  return new;
end;
$$;


drop trigger if exists
  leases_prevent_overlap
on public.leases;


create trigger
  leases_prevent_overlap
before insert or update of
  unit_id,
  organisation_id,
  start_date,
  end_date,
  status
on public.leases
for each row
execute function
  public.prevent_overlapping_live_leases();


-- ---------------------------------------------------------
-- Unit occupancy synchronisation
-- ---------------------------------------------------------

create or replace function public.refresh_unit_occupancy(
  p_unit_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_is_occupied boolean;
begin
  select exists (
    select 1
    from public.leases l
    where l.unit_id =
      p_unit_id

      and l.status in (
        'ACTIVE',
        'EXPIRING_SOON'
      )

      and current_date
        between
          l.start_date
          and l.end_date
  )
  into v_is_occupied;

  if v_is_occupied then

    /*
     * Do not silently override operational
     * MAINTENANCE or INACTIVE states.
     */
    update public.units
    set status = 'OCCUPIED'
    where id = p_unit_id
      and status in (
        'VACANT',
        'RESERVED',
        'OCCUPIED'
      );

  else

    /*
     * Only release units that were marked
     * occupied because of a lease.
     */
    update public.units
    set status = 'VACANT'
    where id = p_unit_id
      and status = 'OCCUPIED';

  end if;
end;
$$;


create or replace function public.sync_lease_unit_occupancy()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then

    perform public.refresh_unit_occupancy(
      old.unit_id
    );

    return old;
  end if;


  /*
   * When a lease moves between units,
   * refresh the old unit as well.
   */
  if tg_op = 'UPDATE'
    and old.unit_id is distinct
      from new.unit_id
  then

    perform public.refresh_unit_occupancy(
      old.unit_id
    );

  end if;


  perform public.refresh_unit_occupancy(
    new.unit_id
  );

  return new;
end;
$$;


drop trigger if exists
  leases_sync_unit_occupancy
on public.leases;


create trigger
  leases_sync_unit_occupancy
after insert or update or delete
on public.leases
for each row
execute function
  public.sync_lease_unit_occupancy();


-- ---------------------------------------------------------
-- Supporting index for conflict/occupancy checks
-- ---------------------------------------------------------

create index if not exists
  leases_live_unit_dates_idx
on public.leases(
  organisation_id,
  unit_id,
  start_date,
  end_date
)
where status in (
  'ACTIVE',
  'EXPIRING_SOON'
);


commit;
