-- Gate check-out, WhatsApp outbox, per-turf / platform WhatsApp accounts.

alter table bookings add column if not exists checked_in_at timestamptz;
alter table bookings add column if not exists checked_out_at timestamptz;

create table if not exists wa_accounts (
  id              text primary key,
  venue_id        text unique,
  provider        text not null default 'cloud',
  token           text not null default '',
  instance        text not null default '',
  display_phone   text not null default '',
  template_owner  text not null default '',
  template_player text not null default '',
  verify_token    text not null default '',
  enabled         boolean not null default false,
  updated_at      timestamptz not null default now()
);

insert into wa_accounts (id, venue_id, provider)
values ('platform', null, 'cloud')
on conflict (id) do nothing;

create table if not exists wa_outbox (
  id          text primary key,
  kind        text not null,
  to_phone    text not null,
  body        text not null,
  booking_id  text,
  venue_id    text,
  provider    text not null default '',
  status      text not null default 'queued',
  error       text not null default '',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

create index if not exists wa_outbox_created_idx on wa_outbox (created_at desc);
