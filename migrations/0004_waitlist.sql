-- Manual waitlist. Staff add a name+phone on a taken slot; when it frees,
-- they copy/share a message. No SMS. No hold on the calendar.

create table if not exists waitlist (
  id text primary key,
  venue_id text not null references venue(id),
  resource_id text not null references resource(id),
  identity_id text references customer_identity(id),
  profile_id text references customer_profile(id),
  name text not null,
  phone_e164 text not null,
  local_date date not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'waiting'
    check (status in ('waiting','notified','booked','cancelled')),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists waitlist_slot_idx
  on waitlist (venue_id, resource_id, local_date, status);
create unique index if not exists waitlist_dup_idx
  on waitlist (venue_id, resource_id, period_start, phone_e164)
  where status = 'waiting';
