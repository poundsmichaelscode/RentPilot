begin;

create type public.notification_type as enum (
  'RENT_DUE_SOON',
  'RENT_DUE_TODAY',
  'RENT_OVERDUE',
  'PAYMENT_RECORDED',
  'PAYMENT_RECEIPT',
  'LEASE_EXPIRING',
  'MAINTENANCE_CREATED',
  'MAINTENANCE_UPDATED',
  'DOCUMENT_SHARED',
  'SYSTEM'
);

create type public.notification_delivery_channel as enum (
  'EMAIL',
  'SMS',
  'WHATSAPP'
);

create type public.notification_delivery_status as enum (
  'PENDING',
  'QUEUED',
  'PROCESSING',
  'SENT',
  'FAILED',
  'CANCELLED'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  recipient_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  actor_user_id uuid
    references public.profiles(id)
    on delete set null,

  type public.notification_type not null,

  title text not null
    check (
      char_length(title) between 1 and 200
    ),

  message text not null
    check (
      char_length(message) between 1 and 5000
    ),

  resource_type text,
  resource_id uuid,

  metadata jsonb not null
    default '{}'::jsonb,

  read_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

create index notifications_recipient_created_idx
  on public.notifications (
    recipient_user_id,
    created_at desc
  );

create index notifications_recipient_unread_idx
  on public.notifications (
    recipient_user_id,
    created_at desc
  )
  where read_at is null;

create index notifications_organisation_idx
  on public.notifications (
    organisation_id,
    created_at desc
  );

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),

  notification_id uuid not null
    references public.notifications(id)
    on delete cascade,

  channel public.notification_delivery_channel
    not null,

  destination text not null,

  status public.notification_delivery_status
    not null
    default 'PENDING',

  provider text,

  provider_message_id text,

  attempt_count integer not null
    default 0
    check (attempt_count >= 0),

  max_attempts integer not null
    default 5
    check (max_attempts > 0),

  queued_at timestamptz,
  processing_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,

  last_error text,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (
    notification_id,
    channel,
    destination
  )
);

create index notification_deliveries_status_idx
  on public.notification_deliveries (
    status,
    created_at
  );

create table public.rent_reminder_jobs (
  id uuid primary key default gen_random_uuid(),

  organisation_id uuid not null
    references public.organisations(id)
    on delete cascade,

  rent_charge_id uuid not null
    references public.rent_charges(id)
    on delete cascade,

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  recipient_user_id uuid
    references public.profiles(id)
    on delete cascade,

  reminder_type public.notification_type
    not null,

  scheduled_for timestamptz not null,

  processed_at timestamptz,

  cancelled_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  check (
    reminder_type in (
      'RENT_DUE_SOON',
      'RENT_DUE_TODAY',
      'RENT_OVERDUE'
    )
  ),

  unique (
    rent_charge_id,
    reminder_type,
    scheduled_for
  )
);

create index rent_reminder_jobs_pending_idx
  on public.rent_reminder_jobs (
    scheduled_for
  )
  where
    processed_at is null
    and cancelled_at is null;

create trigger notifications_set_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row
execute function public.set_updated_at();

create trigger rent_reminder_jobs_set_updated_at
before update on public.rent_reminder_jobs
for each row
execute function public.set_updated_at();

alter table public.notifications
  enable row level security;

alter table public.notification_deliveries
  enable row level security;

alter table public.rent_reminder_jobs
  enable row level security;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
);

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
)
with check (
  recipient_user_id = auth.uid()
);

create policy notification_deliveries_select_own
on public.notification_deliveries
for select
to authenticated
using (
  exists (
    select 1
    from public.notifications n
    where
      n.id = notification_id
      and n.recipient_user_id = auth.uid()
  )
);

comment on table public.notifications is
'User-facing RENTpilot in-app notifications.';

comment on table public.notification_deliveries is
'External delivery attempts for notifications. Provider workers process these rows through queues.';

comment on table public.rent_reminder_jobs is
'Idempotent scheduled rent reminder jobs generated from rent charges.';

commit;
