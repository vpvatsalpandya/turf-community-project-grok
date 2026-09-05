-- Gate staff / manager belong to one turf. Owner remains venues.user_id.

alter table profiles add column if not exists venue_id text;

create index if not exists profiles_venue_id_idx on profiles (venue_id);
