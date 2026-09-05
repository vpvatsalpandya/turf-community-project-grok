create table if not exists profiles (
  user_id      text primary key,
  role         text not null,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

alter table bookings add column if not exists customer_user_id text;

create index if not exists bookings_customer_user_id_idx on bookings (customer_user_id);
