create table if not exists venues (
  id            text primary key,
  user_id       text not null,
  slug          text not null unique,
  name          text not null,
  city          text not null default 'Vadodara',
  area          text not null default '',
  pitch_count   integer not null default 1,
  sport         text not null default '5-a-side football',
  price_inr     integer not null default 800,
  slot_minutes  integer not null default 60,
  open_hour     integer not null default 6,
  close_hour    integer not null default 23,
  upi_id        text not null default '',
  phone         text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now()
);

create index if not exists venues_user_id_idx on venues (user_id);

create table if not exists bookings (
  id              text primary key,
  venue_id        text not null references venues(id) on delete cascade,
  pitch_index     integer not null default 1,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  status          text not null,
  source          text not null default 'link',
  customer_name   text not null,
  customer_phone  text not null,
  notes           text not null default '',
  amount_inr      integer not null,
  created_at      timestamptz not null default now()
);

create index if not exists bookings_venue_start_idx on bookings (venue_id, start_at);
create index if not exists bookings_venue_status_idx on bookings (venue_id, status);
