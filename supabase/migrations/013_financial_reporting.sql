-- =========================================================
-- RENTpilot Phase 2B
-- Financial reporting engine
-- =========================================================

create or replace function
public.get_financial_report(
  p_user_id uuid,
  p_organisation_id uuid,
  p_from date,
  p_to date,
  p_property_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_currency text;
  v_result jsonb;
begin

  -- -------------------------------------------------------
  -- Validation
  -- -------------------------------------------------------

  if p_user_id is null
     or p_organisation_id is null then
    raise exception
      'REPORT_CONTEXT_REQUIRED';
  end if;


  if p_from is null
     or p_to is null then
    raise exception
      'REPORT_DATE_RANGE_REQUIRED';
  end if;


  if p_to < p_from then
    raise exception
      'REPORT_INVALID_DATE_RANGE';
  end if;


  -- -------------------------------------------------------
  -- Authorisation
  --
  -- Service-role calls bypass RLS, so membership is
  -- independently verified here.
  -- -------------------------------------------------------

  if not exists (
    select 1
    from public.organisation_members om
    where
      om.organisation_id =
        p_organisation_id
      and om.user_id =
        p_user_id
      and om.is_active = true
      and om.role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER',
        'ACCOUNTANT'
      )
  ) then
    raise exception
      'FINANCIAL_REPORT_ACCESS_FORBIDDEN';
  end if;


  select
    o.default_currency
  into
    v_currency
  from public.organisations o
  where o.id =
    p_organisation_id;


  if not found then
    raise exception
      'ORGANISATION_NOT_FOUND';
  end if;


  -- -------------------------------------------------------
  -- Optional property scope
  -- -------------------------------------------------------

  if p_property_id is not null then

    if not exists (
      select 1
      from public.properties p
      where
        p.id =
          p_property_id
        and p.organisation_id =
          p_organisation_id
    ) then
      raise exception
        'REPORT_PROPERTY_NOT_FOUND';
    end if;

  end if;


  -- -------------------------------------------------------
  -- Report
  -- -------------------------------------------------------

  with payment_scope as (
    select
      rp.id,
      rp.amount,
      rp.payment_date,
      u.property_id
    from public.rent_payments rp

    join public.leases l
      on l.id =
        rp.lease_id
      and l.organisation_id =
        rp.organisation_id

    join public.units u
      on u.id =
        l.unit_id
      and u.organisation_id =
        rp.organisation_id

    where
      rp.organisation_id =
        p_organisation_id

      and rp.payment_date
        between p_from and p_to

      and (
        p_property_id is null
        or u.property_id =
          p_property_id
      )
  ),

  expense_scope as (
    select
      e.id,
      e.property_id,
      e.amount,
      e.currency,
      e.status,
      e.expense_date
    from public.expenses e
    where
      e.organisation_id =
        p_organisation_id

      and e.expense_date
        between p_from and p_to

      and e.status <>
        'CANCELLED'

      and (
        p_property_id is null
        or e.property_id =
          p_property_id
      )
  ),

  property_scope as (
    select
      p.id,
      p.name
    from public.properties p
    where
      p.organisation_id =
        p_organisation_id

      and (
        p_property_id is null
        or p.id =
          p_property_id
      )
  ),

  property_income as (
    select
      ps.property_id,
      coalesce(
        sum(ps.amount),
        0
      )::numeric as amount
    from payment_scope ps
    group by
      ps.property_id
  ),

  property_paid_expenses as (
    select
      es.property_id,
      coalesce(
        sum(es.amount),
        0
      )::numeric as amount
    from expense_scope es
    where
      es.currency =
        v_currency
      and es.status =
        'PAID'
      and es.property_id
        is not null
    group by
      es.property_id
  ),

  property_pending_expenses as (
    select
      es.property_id,
      coalesce(
        sum(es.amount),
        0
      )::numeric as amount
    from expense_scope es
    where
      es.currency =
        v_currency
      and es.status =
        'PENDING'
      and es.property_id
        is not null
    group by
      es.property_id
  ),

  property_breakdown as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'propertyId',
            p.id,

            'propertyName',
            p.name,

            'rentCollected',
            coalesce(
              pi.amount,
              0
            ),

            'paidExpenses',
            coalesce(
              pe.amount,
              0
            ),

            'pendingExpenses',
            coalesce(
              pp.amount,
              0
            ),

            'netCashFlow',
            coalesce(
              pi.amount,
              0
            )
            -
            coalesce(
              pe.amount,
              0
            )
          )
          order by
            p.name
        ),
        '[]'::jsonb
      ) as data

    from property_scope p

    left join property_income pi
      on pi.property_id =
        p.id

    left join property_paid_expenses pe
      on pe.property_id =
        p.id

    left join property_pending_expenses pp
      on pp.property_id =
        p.id
  ),

  foreign_currency_expenses as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'currency',
            grouped.currency,

            'paidExpenses',
            grouped.paid_amount,

            'pendingExpenses',
            grouped.pending_amount
          )
          order by
            grouped.currency
        ),
        '[]'::jsonb
      ) as data

    from (
      select
        es.currency,

        coalesce(
          sum(es.amount)
            filter (
              where
                es.status =
                  'PAID'
            ),
          0
        )::numeric as
          paid_amount,

        coalesce(
          sum(es.amount)
            filter (
              where
                es.status =
                  'PENDING'
            ),
          0
        )::numeric as
          pending_amount

      from expense_scope es

      where
        es.currency <>
          v_currency

      group by
        es.currency
    ) grouped
  )

  select
    jsonb_build_object(
      'organisationId',
      p_organisation_id,

      'propertyId',
      p_property_id,

      'from',
      p_from,

      'to',
      p_to,

      'currency',
      v_currency,

      'summary',
      jsonb_build_object(

        'rentCollected',
        (
          select
            coalesce(
              sum(ps.amount),
              0
            )
          from payment_scope ps
        ),

        'paidExpenses',
        (
          select
            coalesce(
              sum(es.amount),
              0
            )
          from expense_scope es
          where
            es.currency =
              v_currency
            and es.status =
              'PAID'
        ),

        'pendingExpenses',
        (
          select
            coalesce(
              sum(es.amount),
              0
            )
          from expense_scope es
          where
            es.currency =
              v_currency
            and es.status =
              'PENDING'
        ),

        'netCashFlow',
        (
          select
            coalesce(
              sum(ps.amount),
              0
            )
          from payment_scope ps
        )
        -
        (
          select
            coalesce(
              sum(es.amount),
              0
            )
          from expense_scope es
          where
            es.currency =
              v_currency
            and es.status =
              'PAID'
        ),

        'organisationWidePaidExpenses',
        (
          select
            coalesce(
              sum(es.amount),
              0
            )
          from expense_scope es
          where
            es.currency =
              v_currency
            and es.status =
              'PAID'
            and es.property_id
              is null
        ),

        'organisationWidePendingExpenses',
        (
          select
            coalesce(
              sum(es.amount),
              0
            )
          from expense_scope es
          where
            es.currency =
              v_currency
            and es.status =
              'PENDING'
            and es.property_id
              is null
        )
      ),

      'properties',
      (
        select
          pb.data
        from property_breakdown pb
      ),

      'foreignCurrencyExpenses',
      (
        select
          fce.data
        from foreign_currency_expenses fce
      ),

      'basis',
      jsonb_build_object(
        'accountingBasis',
        'CASH',

        'rentIncomeUses',
        'RECORDED_PAYMENTS',

        'expensesUse',
        'PAID_EXPENSES',

        'pendingExpensesIncludedInNetCashFlow',
        false,

        'cancelledExpensesExcluded',
        true,

        'foreignCurrenciesExcludedFromNetCashFlow',
        true,

        'organisationWideExpensesAllocatedToProperties',
        false
      )
    )
  into
    v_result;


  return v_result;

end;
$$;


-- ---------------------------------------------------------
-- Permissions
--
-- Only the API service-role client executes this RPC.
-- ---------------------------------------------------------

revoke all
on function public.get_financial_report(
  uuid,
  uuid,
  date,
  date,
  uuid
)
from public;


revoke all
on function public.get_financial_report(
  uuid,
  uuid,
  date,
  date,
  uuid
)
from anon;


revoke all
on function public.get_financial_report(
  uuid,
  uuid,
  date,
  date,
  uuid
)
from authenticated;


grant execute
on function public.get_financial_report(
  uuid,
  uuid,
  date,
  date,
  uuid
)
to service_role;


comment on function
public.get_financial_report(
  uuid,
  uuid,
  date,
  date,
  uuid
)
is
  'Returns organisation-scoped cash-basis RENTpilot financial reporting data.';
