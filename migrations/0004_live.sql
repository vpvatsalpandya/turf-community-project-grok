-- Live booking: map pin, photos, 20-minute holds, one pitch per kick-off, request throttle.

alter table venues add column if not exists lat double precision;
alter table venues add column if not exists lng double precision;
alter table venues add column if not exists address text not null default '';
alter table venues add column if not exists photos jsonb not null default '[]'::jsonb;

alter table bookings add column if not exists hold_until timestamptz;

update bookings
set status = 'expired'
where status = 'pending'
  and created_at < now() - interval '20 minutes';

create unique index if not exists bookings_active_slot_uidx
  on bookings (venue_id, pitch_index, start_at)
  where status in ('pending', 'confirmed', 'checked_in');

create table if not exists request_limits (
  phone text not null,
  bucket text not null,
  n integer not null default 0,
  primary key (phone, bucket)
);
