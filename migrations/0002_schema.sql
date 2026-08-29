-- Turf Community schema. Tenant table is `org` because Better Auth owns `account`.
-- No extensions (PGLite preview). Overlap is enforced in turf_* functions, not gist.

create table if not exists org (
  id text primary key,
  legal_name text not null,
  gstin text,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','read_only','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists venue (
  id text primary key,
  org_id text not null references org(id),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Asia/Kolkata',
  address text,
  city text,
  lat double precision,
  lng double precision,
  amenities text[] not null default '{}',
  photos jsonb not null default '[]',
  upi_id text,
  contact_phone text,
  request_window_minutes integer not null default 240,
  status text not null default 'active',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists venue_org_idx on venue (org_id);

create table if not exists app_user (
  id text primary key,
  user_id text not null unique,
  org_id text not null references org(id),
  venue_id text references venue(id),
  role text not null check (role in ('platform_admin','owner','manager','staff')),
  display_name text,
  email text,
  phone text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists app_user_org_idx on app_user (org_id);
create index if not exists app_user_user_id_idx on app_user (user_id);

create table if not exists staff_invite (
  id text primary key,
  org_id text not null references org(id),
  venue_id text references venue(id),
  email text not null,
  role text not null check (role in ('manager','staff')),
  invited_by text,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table if not exists resource (
  id text primary key,
  venue_id text not null references venue(id),
  parent_id text references resource(id),
  name text not null,
  sport text,
  slot_minutes integer not null default 60,
  buffer_minutes integer not null default 0,
  min_slots integer not null default 1,
  max_slots integer not null default 6,
  allow_flexible_start boolean not null default false,
  is_bookable boolean not null default true,
  sort_order integer not null default 0,
  status text not null default 'active'
);
create index if not exists resource_venue_idx on resource (venue_id);

create table if not exists resource_tree (
  ancestor_id text not null references resource(id) on delete cascade,
  descendant_id text not null references resource(id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id)
);
create index if not exists resource_tree_desc_idx on resource_tree (descendant_id);

create table if not exists operating_window (
  id text primary key,
  resource_id text not null references resource(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  opens_at time not null,
  closes_minutes_from_midnight integer not null
);
create index if not exists operating_window_res_idx on operating_window (resource_id, day_of_week);

create table if not exists price_band (
  id text primary key,
  resource_id text not null references resource(id) on delete cascade,
  day_of_week smallint,
  starts_at time not null,
  ends_at time not null,
  price_paise integer not null,
  label text,
  priority integer not null default 0
);
create index if not exists price_band_res_idx on price_band (resource_id);

create table if not exists date_override (
  id text primary key,
  venue_id text references venue(id),
  resource_id text references resource(id),
  on_date date not null,
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  price_multiplier numeric(4,2),
  reason text
);

create table if not exists blackout (
  id text primary key,
  resource_id text not null references resource(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  reason text not null,
  created_by text,
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index if not exists blackout_res_idx on blackout (resource_id, period_start);

create table if not exists customer_identity (
  id text primary key,
  phone_e164 text not null unique,
  phone_verified boolean not null default false,
  display_name text,
  email text,
  reliability_score numeric(4,1) not null default 100.0,
  lifetime_bookings integer not null default 0,
  lifetime_no_shows integer not null default 0,
  lifetime_late_cancels integer not null default 0,
  merged_into text references customer_identity(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists customer_profile (
  id text primary key,
  identity_id text not null references customer_identity(id),
  venue_id text not null references venue(id),
  name_at_venue text,
  notes text,
  tags text[] not null default '{}',
  first_booked_at timestamptz,
  last_booked_at timestamptz,
  total_bookings integer not null default 0,
  total_spend_paise integer not null default 0,
  unique (identity_id, venue_id)
);
create index if not exists customer_profile_venue_idx on customer_profile (venue_id);

create table if not exists otp_challenge (
  id text primary key,
  phone_e164 text not null,
  code text not null,
  venue_id text,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists otp_phone_idx on otp_challenge (phone_e164, expires_at);

create table if not exists promo_code (
  id text primary key,
  venue_id text not null references venue(id),
  code text not null,
  type text not null check (type in ('percent','flat')),
  value numeric(10,2) not null,
  max_discount_paise integer,
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit_total integer,
  usage_limit_per_customer integer default 1,
  applicable_resource_ids text[],
  applicable_day_of_week smallint[],
  applicable_time_start time,
  applicable_time_end time,
  times_used integer not null default 0,
  active boolean not null default true,
  unique (venue_id, code)
);

create table if not exists booking_series (
  id text primary key,
  venue_id text not null references venue(id),
  created_at timestamptz not null default now()
);

create table if not exists booking (
  id text primary key,
  ref_code text not null unique,
  venue_id text not null references venue(id),
  resource_id text not null references resource(id),
  identity_id text references customer_identity(id),
  profile_id text references customer_profile(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  blocked_start timestamptz not null,
  blocked_end timestamptz not null,
  local_date date not null,
  state text not null check (state in (
    'requested','confirmed','checked_in','completed','no_show','cancelled','declined','lapsed'
  )),
  channel text not null check (channel in ('link','staff','phone','walkin')),
  series_id text references booking_series(id),
  price_paise integer not null,
  discount_paise integer not null default 0,
  loyalty_redeemed_paise integer not null default 0,
  amount_due_paise integer not null,
  amount_collected_paise integer not null default 0,
  payment_mode text,
  payment_note text,
  promo_code_id text references promo_code(id),
  policy_snapshot jsonb not null default '{}',
  request_expires_at timestamptz,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  created_by text,
  client_request_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index if not exists booking_venue_date_idx on booking (venue_id, local_date);
create index if not exists booking_state_exp_idx on booking (state, request_expires_at);
create index if not exists booking_resource_period_idx on booking (resource_id, period_start, period_end);
create index if not exists booking_identity_idx on booking (identity_id);

create table if not exists booking_event (
  id bigserial primary key,
  booking_id text not null references booking(id),
  from_state text,
  to_state text not null,
  actor_id text,
  actor_type text not null,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_event_booking_idx on booking_event (booking_id);

create table if not exists slot_hold (
  id text primary key,
  resource_id text not null references resource(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  session_token text,
  expires_at timestamptz not null
);
create index if not exists slot_hold_exp_idx on slot_hold (expires_at);

create table if not exists loyalty_program (
  id text primary key,
  venue_id text not null references venue(id),
  name text not null,
  type text not null check (type in ('visit_stamp','spend_threshold','points')),
  config jsonb not null,
  expiry_months integer not null default 12,
  starts_on date,
  ends_on date,
  status text not null default 'active'
);

create table if not exists loyalty_ledger (
  id bigserial primary key,
  profile_id text not null references customer_profile(id),
  program_id text not null references loyalty_program(id),
  booking_id text references booking(id),
  delta integer not null,
  balance_after integer not null,
  kind text not null check (kind in ('earn','redeem','expire','adjust')),
  expires_on date,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_ledger_profile_idx on loyalty_ledger (profile_id, program_id);

create table if not exists message_template (
  id text primary key,
  venue_id text references venue(id),
  kind text not null,
  body text not null,
  language text not null default 'en',
  unique (venue_id, kind, language)
);

create table if not exists subscription (
  org_id text primary key references org(id),
  base_paise integer not null default 99900,
  included_venues integer not null default 2,
  extra_venue_paise integer not null default 24900,
  status text not null,
  trial_ends_on date,
  current_period_start date,
  current_period_end date,
  next_invoice_on date,
  referred boolean not null default false
);

create table if not exists subscription_discount (
  id text primary key,
  org_id text not null references org(id),
  type text not null check (type in ('percent','flat')),
  value numeric(10,2) not null,
  reason text,
  applies_from date not null,
  applies_until date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists invoice (
  id text primary key,
  org_id text not null references org(id),
  period_start date not null,
  period_end date not null,
  base_paise integer not null,
  extra_venue_count integer not null default 0,
  extra_venue_paise integer not null default 0,
  discount_paise integer not null default 0,
  discount_snapshot jsonb,
  amount_due_paise integer not null,
  status text not null default 'due' check (status in ('due','paid','waived','overdue')),
  paid_via text,
  payment_ref text,
  marked_paid_by text,
  paid_at timestamptz,
  unique (org_id, period_start)
);

create table if not exists referral_code (
  code text primary key,
  referrer_name text not null,
  referrer_phone text not null,
  referrer_upi text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists referral (
  id text primary key,
  code text not null references referral_code(code),
  referred_org_id text not null references org(id) unique,
  status text not null default 'signed_up'
    check (status in ('signed_up','qualified','payout_due','paid','void')),
  qualified_at timestamptz,
  payout_paise integer not null default 49900,
  payout_ref text,
  paid_at timestamptz,
  flagged_reason text,
  notes text
);

create table if not exists data_export_log (
  id bigserial primary key,
  org_id text,
  actor_id text,
  kind text not null,
  row_count integer not null,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists noshow_flag (
  id text primary key,
  booking_id text not null unique references booking(id),
  flagged_at timestamptz not null default now(),
  reviewed_at timestamptz,
  dismissed boolean not null default false
);
