-- =========================================================
-- RENTpilot Phase 2A
-- Expenses and operating costs
-- =========================================================

-- ---------------------------------------------------------
-- Expense table
-- ---------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key
    default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete restrict,

  property_id uuid
    references public.properties(id)
    on delete restrict,

  unit_id uuid
    references public.units(id)
    on delete restrict,

  category text not null
    check (
      category in (
        'MAINTENANCE',
        'REPAIRS',
        'UTILITIES',
        'INSURANCE',
        'PROPERTY_TAX',
        'SECURITY',
        'CLEANING',
        'MANAGEMENT_FEE',
        'LEGAL_PROFESSIONAL',
        'RENOVATION',
        'OTHER'
      )
    ),

  description text not null
    check (
      char_length(
        trim(description)
      ) between 2 and 500
    ),

  amount numeric(14,2) not null
    check (amount > 0),

  currency text not null
    check (
      currency ~ '^[A-Z]{3}$'
    ),

  expense_date date not null,

  vendor_name text,

  reference text,

  payment_method text
    check (
      payment_method is null
      or payment_method in (
        'BANK_TRANSFER',
        'CASH',
        'CARD',
        'POS',
        'CHEQUE',
        'OTHER'
      )
    ),

  status text not null
    default 'PAID'
    check (
      status in (
        'PENDING',
        'PAID',
        'CANCELLED'
      )
    ),

  notes text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  updated_by uuid
    references public.profiles(id)
    on delete set null,

  cancelled_by uuid
    references public.profiles(id)
    on delete set null,

  cancelled_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint expenses_unit_requires_property
    check (
      unit_id is null
      or property_id is not null
    )
);


-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------

create index if not exists
  expenses_organisation_date_idx
on public.expenses(
  organisation_id,
  expense_date desc
);


create index if not exists
  expenses_property_date_idx
on public.expenses(
  organisation_id,
  property_id,
  expense_date desc
);


create index if not exists
  expenses_unit_date_idx
on public.expenses(
  organisation_id,
  unit_id,
  expense_date desc
);


create index if not exists
  expenses_category_date_idx
on public.expenses(
  organisation_id,
  category,
  expense_date desc
);


create index if not exists
  expenses_status_date_idx
on public.expenses(
  organisation_id,
  status,
  expense_date desc
);


-- ---------------------------------------------------------
-- Organisation / property / unit integrity
-- ---------------------------------------------------------

create or replace function
public.validate_expense_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_unit_property_id uuid;
begin

  /*
   * Property must belong to the selected
   * organisation.
   */
  if new.property_id is not null then

    if not exists (
      select 1
      from public.properties p
      where p.id = new.property_id
        and p.organisation_id =
          new.organisation_id
    ) then
      raise exception
        'EXPENSE_PROPERTY_ORGANISATION_MISMATCH';
    end if;

  end if;


  /*
   * Unit must belong to the selected
   * organisation.
   *
   * Also guarantee that the property's
   * identity matches the unit.
   */
  if new.unit_id is not null then

    select
      u.property_id
    into
      v_unit_property_id
    from public.units u
    where u.id = new.unit_id
      and u.organisation_id =
        new.organisation_id;

    if not found then
      raise exception
        'EXPENSE_UNIT_ORGANISATION_MISMATCH';
    end if;


    if new.property_id is null then

      new.property_id :=
        v_unit_property_id;

    elsif new.property_id <>
      v_unit_property_id then

      raise exception
        'EXPENSE_UNIT_PROPERTY_MISMATCH';

    end if;

  end if;


  /*
   * Cancellation metadata.
   */
  if tg_op = 'INSERT' then

    if new.status = 'CANCELLED' then

      if new.cancelled_by is null then
        raise exception
          'EXPENSE_CANCELLED_BY_REQUIRED';
      end if;

      new.cancelled_at :=
        coalesce(
          new.cancelled_at,
          now()
        );

    else

      new.cancelled_by := null;
      new.cancelled_at := null;

    end if;

  elsif tg_op = 'UPDATE' then

    /*
     * Once cancelled, the financial record
     * is immutable. Owners can still hard
     * delete through the controlled RPC.
     */
    if old.status = 'CANCELLED' then
      raise exception
        'CANCELLED_EXPENSE_IMMUTABLE';
    end if;


    if new.status = 'CANCELLED' then

      if new.cancelled_by is null then
        raise exception
          'EXPENSE_CANCELLED_BY_REQUIRED';
      end if;

      new.cancelled_at :=
        coalesce(
          new.cancelled_at,
          now()
        );

    else

      new.cancelled_by := null;
      new.cancelled_at := null;

    end if;

  end if;


  return new;

end;
$$;


drop trigger if exists
  expenses_validate_scope
on public.expenses;


create trigger
  expenses_validate_scope
before insert or update
on public.expenses
for each row
execute function
  public.validate_expense_scope();


-- ---------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------

drop trigger if exists
  expenses_set_updated_at
on public.expenses;


create trigger
  expenses_set_updated_at
before update
on public.expenses
for each row
execute function
  public.set_updated_at();


-- ---------------------------------------------------------
-- Audit logging
-- ---------------------------------------------------------

create or replace function
public.audit_expense_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_actor_id uuid;
begin

  if tg_op = 'INSERT' then

    v_action :=
      'EXPENSE_CREATED';

    v_actor_id :=
      new.created_by;

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
      v_actor_id,
      v_action,
      'expense',
      new.id,
      'Expense was created',
      jsonb_build_object(
        'property_id',
        new.property_id,
        'unit_id',
        new.unit_id,
        'category',
        new.category,
        'amount',
        new.amount,
        'currency',
        new.currency,
        'status',
        new.status,
        'expense_date',
        new.expense_date
      )
    );

    return new;

  end if;


  if tg_op = 'UPDATE' then

    if
      old.status <> 'CANCELLED'
      and new.status = 'CANCELLED'
    then

      v_action :=
        'EXPENSE_CANCELLED';

      v_actor_id :=
        coalesce(
          new.cancelled_by,
          new.updated_by,
          new.created_by
        );

    else

      v_action :=
        'EXPENSE_UPDATED';

      v_actor_id :=
        coalesce(
          new.updated_by,
          new.created_by
        );

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
      v_actor_id,
      v_action,
      'expense',
      new.id,
      case
        when v_action =
          'EXPENSE_CANCELLED'
        then 'Expense was cancelled'
        else 'Expense was updated'
      end,
      jsonb_build_object(
        'property_id',
        new.property_id,
        'unit_id',
        new.unit_id,
        'category',
        new.category,
        'previous_amount',
        old.amount,
        'amount',
        new.amount,
        'currency',
        new.currency,
        'previous_status',
        old.status,
        'status',
        new.status,
        'expense_date',
        new.expense_date
      )
    );

    return new;

  end if;


  return null;

end;
$$;


drop trigger if exists
  expenses_audit_changes
on public.expenses;


create trigger
  expenses_audit_changes
after insert or update
on public.expenses
for each row
execute function
  public.audit_expense_changes();


-- ---------------------------------------------------------
-- Controlled hard deletion
--
-- OWNER and ADMIN only.
-- The API must pass the authenticated user's UUID.
-- ---------------------------------------------------------

create or replace function
public.delete_expense(
  p_user_id uuid,
  p_organisation_id uuid,
  p_expense_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
begin

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
        'ADMIN'
      )
  ) then
    raise exception
      'EXPENSE_DELETE_FORBIDDEN';
  end if;


  select *
  into v_expense
  from public.expenses e
  where e.id = p_expense_id
    and e.organisation_id =
      p_organisation_id
  for update;


  if not found then
    raise exception
      'EXPENSE_NOT_FOUND';
  end if;


  /*
   * Preserve the important financial
   * history before hard deletion.
   */
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
    'EXPENSE_DELETED',
    'expense',
    v_expense.id,
    'Expense was deleted',
    jsonb_build_object(
      'property_id',
      v_expense.property_id,
      'unit_id',
      v_expense.unit_id,
      'category',
      v_expense.category,
      'description',
      v_expense.description,
      'amount',
      v_expense.amount,
      'currency',
      v_expense.currency,
      'status',
      v_expense.status,
      'expense_date',
      v_expense.expense_date,
      'vendor_name',
      v_expense.vendor_name,
      'reference',
      v_expense.reference
    )
  );


  delete from public.expenses
  where id = p_expense_id
    and organisation_id =
      p_organisation_id;


  return jsonb_build_object(
    'deleted',
    true,
    'expenseId',
    p_expense_id
  );

end;
$$;


-- ---------------------------------------------------------
-- Row Level Security
--
-- Browser clients receive read access only.
-- Expense mutations are performed by the API using the
-- server-side Supabase client plus application-level roles.
-- ---------------------------------------------------------

alter table public.expenses
enable row level security;


drop policy if exists
  expenses_member_select
on public.expenses;


create policy
  expenses_member_select
on public.expenses
for select
to authenticated
using (
  exists (
    select 1
    from public.organisation_members om
    where
      om.organisation_id =
        expenses.organisation_id
      and om.user_id =
        auth.uid()
      and om.is_active = true
      and om.role in (
        'OWNER',
        'ADMIN',
        'PROPERTY_MANAGER',
        'ACCOUNTANT'
      )
  )
);


-- ---------------------------------------------------------
-- Grants
-- ---------------------------------------------------------

revoke all
on public.expenses
from anon;


revoke insert, update, delete
on public.expenses
from authenticated;


grant select
on public.expenses
to authenticated;


grant all
on public.expenses
to service_role;


revoke all
on function public.delete_expense(
  uuid,
  uuid,
  uuid
)
from public;


revoke all
on function public.delete_expense(
  uuid,
  uuid,
  uuid
)
from anon;


revoke all
on function public.delete_expense(
  uuid,
  uuid,
  uuid
)
from authenticated;


grant execute
on function public.delete_expense(
  uuid,
  uuid,
  uuid
)
to service_role;


-- ---------------------------------------------------------
-- Documentation
-- ---------------------------------------------------------

comment on table public.expenses is
  'Organisation-scoped rental property operating expenses.';


comment on column
public.expenses.organisation_id is
  'Owning RENTpilot organisation.';


comment on column
public.expenses.property_id is
  'Optional property scope for organisation-level or property-level expenses.';


comment on column
public.expenses.unit_id is
  'Optional unit scope. When supplied, property_id is derived or validated against the unit.';


comment on column
public.expenses.status is
  'Expense workflow state: PENDING, PAID, or CANCELLED.';
