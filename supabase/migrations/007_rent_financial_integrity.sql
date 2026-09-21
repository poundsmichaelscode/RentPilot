begin;

-- =========================================================
-- RENTpilot Phase 1F
-- Rent charges, payments, overdue state and receipts
-- =========================================================


-- ---------------------------------------------------------
-- Recalculate one rent charge
-- ---------------------------------------------------------

create or replace function public.recalculate_rent_charge(
  p_charge_id uuid
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_expected numeric(14,2);
  v_waived numeric(14,2);
  v_due_date date;
  v_paid numeric(14,2);
  v_balance numeric(14,2);
  v_status text;
begin
  select
    rc.expected_amount,
    rc.waived_amount,
    rc.due_date
  into
    v_expected,
    v_waived,
    v_due_date
  from public.rent_charges rc
  where rc.id = p_charge_id
  for update;

  if not found then
    return;
  end if;

  select coalesce(sum(rp.amount), 0)
  into v_paid
  from public.rent_payments rp
  where rp.rent_charge_id = p_charge_id;

  v_balance :=
    greatest(
      v_expected - v_waived - v_paid,
      0
    );

  if v_waived >= v_expected
    and v_paid = 0
  then
    v_status := 'WAIVED';

  elsif v_balance = 0 then
    v_status := 'PAID';

  elsif v_due_date < current_date then
    /*
     * OVERDUE takes precedence whenever money remains
     * outstanding after the due date.
     *
     * Paid/balance values remain available separately,
     * so partially-paid overdue charges are still visible.
     */
    v_status := 'OVERDUE';

  elsif v_paid > 0 then
    v_status := 'PARTIALLY_PAID';

  else
    v_status := 'PENDING';
  end if;

  update public.rent_charges
  set status = v_status
  where id = p_charge_id
    and status is distinct from v_status;
end;
$$;


-- ---------------------------------------------------------
-- Payment trigger keeps charge state authoritative
-- ---------------------------------------------------------

create or replace function public.sync_payment_charge_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.rent_charge_id is not null then
      perform public.recalculate_rent_charge(
        old.rent_charge_id
      );
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.rent_charge_id is distinct from new.rent_charge_id
    and old.rent_charge_id is not null
  then
    perform public.recalculate_rent_charge(
      old.rent_charge_id
    );
  end if;

  if new.rent_charge_id is not null then
    perform public.recalculate_rent_charge(
      new.rent_charge_id
    );
  end if;

  return new;
end;
$$;


drop trigger if exists
  rent_payments_sync_charge_status
on public.rent_payments;

create trigger
  rent_payments_sync_charge_status
after insert or update or delete
on public.rent_payments
for each row
execute function public.sync_payment_charge_status();


-- ---------------------------------------------------------
-- Refresh overdue/current status for an organisation
-- ---------------------------------------------------------

create or replace function public.refresh_rent_charge_statuses(
  p_user_id uuid,
  p_organisation_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge record;
  v_count integer := 0;
begin
  if not exists (
    select 1
    from public.organisation_members om
    where om.organisation_id = p_organisation_id
      and om.user_id = p_user_id
      and om.is_active = true
  ) then
    raise exception 'RENT_CHARGE_ACCESS_FORBIDDEN';
  end if;

  for v_charge in
    select rc.id
    from public.rent_charges rc
    where rc.organisation_id = p_organisation_id
      and rc.status not in (
        'PAID',
        'WAIVED'
      )
  loop
    perform public.recalculate_rent_charge(
      v_charge.id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ---------------------------------------------------------
-- Generate next scheduled charge
--
-- rent_amount is interpreted as the amount due for one
-- configured payment_frequency period.
-- ---------------------------------------------------------

create or replace function public.generate_next_rent_charge(
  p_user_id uuid,
  p_organisation_id uuid,
  p_lease_id uuid,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_period_start date;
  v_period_end date;
  v_months integer;
  v_charge_id uuid;
  v_existing_id uuid;
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
        'PROPERTY_MANAGER',
        'ACCOUNTANT'
      )
  ) then
    raise exception 'RENT_CHARGE_CREATE_FORBIDDEN';
  end if;

  /*
   * Serialise automatic generation for one lease.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      'rent-charge:' || p_lease_id::text,
      0
    )
  );

  select *
  into v_lease
  from public.leases l
  where l.id = p_lease_id
    and l.organisation_id = p_organisation_id
  for update;

  if not found then
    raise exception 'LEASE_NOT_FOUND';
  end if;

  if v_lease.status not in (
    'ACTIVE',
    'EXPIRING_SOON'
  ) then
    raise exception 'LEASE_NOT_BILLABLE';
  end if;

  v_months :=
    case v_lease.payment_frequency
      when 'MONTHLY' then 1
      when 'QUARTERLY' then 3
      when 'BIANNUAL' then 6
      when 'ANNUAL' then 12
      else null
    end;

  if v_months is null then
    raise exception
      'CUSTOM_FREQUENCY_REQUIRES_MANUAL_CHARGE';
  end if;

  select
    coalesce(
      max(rc.period_end) + 1,
      v_lease.start_date
    )
  into v_period_start
  from public.rent_charges rc
  where rc.lease_id = p_lease_id;

  if v_period_start > v_lease.end_date then
    raise exception 'LEASE_FULLY_BILLED';
  end if;

  v_period_end :=
    least(
      v_lease.end_date,
      (
        v_period_start
        + make_interval(months => v_months)
        - interval '1 day'
      )::date
    );

  /*
   * Retry-safe lookup.
   */
  select rc.id
  into v_existing_id
  from public.rent_charges rc
  where rc.lease_id = p_lease_id
    and rc.period_start = v_period_start
    and rc.period_end = v_period_end
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'chargeId',
      v_existing_id,
      'created',
      false
    );
  end if;

  insert into public.rent_charges (
    organisation_id,
    lease_id,
    period_start,
    period_end,
    due_date,
    expected_amount,
    waived_amount,
    status
  )
  values (
    p_organisation_id,
    p_lease_id,
    v_period_start,
    v_period_end,
    coalesce(
      p_due_date,
      v_period_start
    ),
    v_lease.rent_amount,
    0,
    case
      when coalesce(
        p_due_date,
        v_period_start
      ) < current_date
      then 'OVERDUE'
      else 'PENDING'
    end
  )
  returning id
  into v_charge_id;

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
    'RENT_CHARGE_CREATED',
    'rent_charge',
    v_charge_id,
    'Rent charge was generated',
    jsonb_build_object(
      'lease_id',
      p_lease_id,
      'period_start',
      v_period_start,
      'period_end',
      v_period_end,
      'expected_amount',
      v_lease.rent_amount
    )
  );

  return jsonb_build_object(
    'chargeId',
    v_charge_id,
    'created',
    true,
    'periodStart',
    v_period_start,
    'periodEnd',
    v_period_end,
    'expectedAmount',
    v_lease.rent_amount
  );
end;
$$;


-- ---------------------------------------------------------
-- Manual charge for CUSTOM schedules or adjustments
-- ---------------------------------------------------------

create or replace function public.create_manual_rent_charge(
  p_user_id uuid,
  p_organisation_id uuid,
  p_lease_id uuid,
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_expected_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lease public.leases%rowtype;
  v_charge_id uuid;
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
        'PROPERTY_MANAGER',
        'ACCOUNTANT'
      )
  ) then
    raise exception 'RENT_CHARGE_CREATE_FORBIDDEN';
  end if;

  if p_period_end < p_period_start then
    raise exception 'INVALID_CHARGE_PERIOD';
  end if;

  if p_expected_amount <= 0 then
    raise exception 'INVALID_CHARGE_AMOUNT';
  end if;

  select *
  into v_lease
  from public.leases l
  where l.id = p_lease_id
    and l.organisation_id = p_organisation_id;

  if not found then
    raise exception 'LEASE_NOT_FOUND';
  end if;

  if p_period_start < v_lease.start_date
    or p_period_end > v_lease.end_date
  then
    raise exception 'CHARGE_OUTSIDE_LEASE_PERIOD';
  end if;

  insert into public.rent_charges (
    organisation_id,
    lease_id,
    period_start,
    period_end,
    due_date,
    expected_amount,
    waived_amount,
    status,
    notes
  )
  values (
    p_organisation_id,
    p_lease_id,
    p_period_start,
    p_period_end,
    p_due_date,
    p_expected_amount,
    0,
    case
      when p_due_date < current_date
      then 'OVERDUE'
      else 'PENDING'
    end,
    nullif(
      trim(coalesce(p_notes, '')),
      ''
    )
  )
  returning id
  into v_charge_id;

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
    'RENT_CHARGE_CREATED',
    'rent_charge',
    v_charge_id,
    'Manual rent charge was created',
    jsonb_build_object(
      'lease_id',
      p_lease_id,
      'period_start',
      p_period_start,
      'period_end',
      p_period_end,
      'expected_amount',
      p_expected_amount
    )
  );

  return jsonb_build_object(
    'chargeId',
    v_charge_id,
    'created',
    true
  );
end;
$$;


-- ---------------------------------------------------------
-- Record payment + generate receipt atomically
-- ---------------------------------------------------------

create or replace function public.record_rent_payment(
  p_user_id uuid,
  p_organisation_id uuid,
  p_lease_id uuid,
  p_rent_charge_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge public.rent_charges%rowtype;
  v_existing_payment_id uuid;
  v_existing_receipt_id uuid;
  v_existing_receipt_number text;
  v_paid_before numeric(14,2);
  v_outstanding numeric(14,2);
  v_payment_id uuid;
  v_receipt_id uuid;
  v_receipt_number text;
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
        'PROPERTY_MANAGER',
        'ACCOUNTANT'
      )
  ) then
    raise exception 'PAYMENT_CREATE_FORBIDDEN';
  end if;

  if p_amount <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  if p_payment_method not in (
    'BANK_TRANSFER',
    'CASH',
    'CARD',
    'POS',
    'CHEQUE',
    'OTHER'
  ) then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  if char_length(
    trim(coalesce(p_idempotency_key, ''))
  ) < 8 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  /*
   * Serialise retries using the same idempotency key.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organisation_id::text
      || ':'
      || trim(p_idempotency_key),
      0
    )
  );

  select rp.id
  into v_existing_payment_id
  from public.rent_payments rp
  where rp.organisation_id = p_organisation_id
    and rp.idempotency_key =
      trim(p_idempotency_key)
  limit 1;

  if v_existing_payment_id is not null then
    select
      r.id,
      r.receipt_number
    into
      v_existing_receipt_id,
      v_existing_receipt_number
    from public.receipts r
    where r.payment_id =
      v_existing_payment_id;

    return jsonb_build_object(
      'paymentId',
      v_existing_payment_id,
      'receiptId',
      v_existing_receipt_id,
      'receiptNumber',
      v_existing_receipt_number,
      'created',
      false
    );
  end if;

  select *
  into v_charge
  from public.rent_charges rc
  where rc.id = p_rent_charge_id
    and rc.organisation_id = p_organisation_id
  for update;

  if not found then
    raise exception 'RENT_CHARGE_NOT_FOUND';
  end if;

  if v_charge.lease_id <> p_lease_id then
    raise exception 'PAYMENT_LEASE_MISMATCH';
  end if;

  if v_charge.status = 'WAIVED' then
    raise exception 'RENT_CHARGE_WAIVED';
  end if;

  select coalesce(sum(rp.amount), 0)
  into v_paid_before
  from public.rent_payments rp
  where rp.rent_charge_id =
    p_rent_charge_id;

  v_outstanding :=
    greatest(
      v_charge.expected_amount
      - v_charge.waived_amount
      - v_paid_before,
      0
    );

  if v_outstanding <= 0 then
    raise exception 'RENT_CHARGE_ALREADY_SETTLED';
  end if;

  /*
   * MVP policy:
   * Reject overpayments rather than silently allocating
   * excess cash to another charge.
   */
  if p_amount > v_outstanding then
    raise exception 'PAYMENT_EXCEEDS_OUTSTANDING';
  end if;

  insert into public.rent_payments (
    organisation_id,
    lease_id,
    rent_charge_id,
    amount,
    payment_date,
    payment_method,
    reference,
    notes,
    recorded_by,
    idempotency_key
  )
  values (
    p_organisation_id,
    p_lease_id,
    p_rent_charge_id,
    p_amount,
    p_payment_date,
    p_payment_method,
    nullif(
      trim(coalesce(p_reference, '')),
      ''
    ),
    nullif(
      trim(coalesce(p_notes, '')),
      ''
    ),
    p_user_id,
    trim(p_idempotency_key)
  )
  returning id
  into v_payment_id;

  /*
   * Deterministic-enough human receipt identifier.
   * payment_id is UUID and itself unique.
   */
  v_receipt_number :=
    'RP-'
    || to_char(p_payment_date, 'YYYYMMDD')
    || '-'
    || upper(
      substr(
        replace(
          v_payment_id::text,
          '-',
          ''
        ),
        1,
        12
      )
    );

  insert into public.receipts (
    organisation_id,
    payment_id,
    receipt_number,
    status,
    issued_by
  )
  values (
    p_organisation_id,
    v_payment_id,
    v_receipt_number,
    'ISSUED',
    p_user_id
  )
  returning id
  into v_receipt_id;

  /*
   * Trigger also performs this, but explicit recalculation
   * makes the returned transaction state unambiguous.
   */
  perform public.recalculate_rent_charge(
    p_rent_charge_id
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
    'RENT_PAYMENT_RECORDED',
    'rent_payment',
    v_payment_id,
    'Rent payment was recorded',
    jsonb_build_object(
      'lease_id',
      p_lease_id,
      'rent_charge_id',
      p_rent_charge_id,
      'amount',
      p_amount,
      'payment_method',
      p_payment_method,
      'receipt_id',
      v_receipt_id,
      'receipt_number',
      v_receipt_number
    )
  );

  return jsonb_build_object(
    'paymentId',
    v_payment_id,
    'receiptId',
    v_receipt_id,
    'receiptNumber',
    v_receipt_number,
    'created',
    true
  );
end;
$$;


-- ---------------------------------------------------------
-- Privileged server-only execution
-- ---------------------------------------------------------

revoke all
on function public.refresh_rent_charge_statuses(
  uuid,
  uuid
)
from public, anon, authenticated;

grant execute
on function public.refresh_rent_charge_statuses(
  uuid,
  uuid
)
to service_role;


revoke all
on function public.generate_next_rent_charge(
  uuid,
  uuid,
  uuid,
  date
)
from public, anon, authenticated;

grant execute
on function public.generate_next_rent_charge(
  uuid,
  uuid,
  uuid,
  date
)
to service_role;


revoke all
on function public.create_manual_rent_charge(
  uuid,
  uuid,
  uuid,
  date,
  date,
  date,
  numeric,
  text
)
from public, anon, authenticated;

grant execute
on function public.create_manual_rent_charge(
  uuid,
  uuid,
  uuid,
  date,
  date,
  date,
  numeric,
  text
)
to service_role;


revoke all
on function public.record_rent_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.record_rent_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  numeric,
  date,
  text,
  text,
  text,
  text
)
to service_role;


commit;
