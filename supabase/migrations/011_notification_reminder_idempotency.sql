begin;

create unique index
if not exists notifications_rent_reminder_dedupe_idx
on public.notifications (
  recipient_user_id,
  type,
  resource_type,
  resource_id
)
where
  resource_type = 'rent_reminder_job'
  and resource_id is not null;

comment on index
public.notifications_rent_reminder_dedupe_idx
is
'Prevents duplicate notifications for the same tenant rent-reminder job.';

commit;
