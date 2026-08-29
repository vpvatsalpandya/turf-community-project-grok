-- Closure table + booking concurrency. One-statement functions so Neon pooling
-- still runs each call atomically. Deterministic FOR UPDATE order avoids deadlocks.

create or replace function rebuild_resource_tree(p_venue_id text)
returns void
language plpgsql
as $$
begin
  delete from resource_tree
  where descendant_id in (select id from resource where venue_id = p_venue_id)
     or ancestor_id in (select id from resource where venue_id = p_venue_id);

  insert into resource_tree (ancestor_id, descendant_id, depth)
  select r.id, r.id, 0 from resource r where r.venue_id = p_venue_id;

  insert into resource_tree (ancestor_id, descendant_id, depth)
  with recursive walk as (
    select id as descendant_id, parent_id as ancestor_id, 1 as depth
    from resource
    where venue_id = p_venue_id and parent_id is not null
    union all
    select w.descendant_id, r.parent_id, w.depth + 1
    from walk w
    join resource r on r.id = w.ancestor_id
    where r.parent_id is not null
  )
  select ancestor_id, descendant_id, depth from walk where ancestor_id is not null;
end;
$$;

create or replace function trg_resource_tree()
returns trigger
language plpgsql
as $$
declare
  vid text;
begin
  vid := coalesce(new.venue_id, old.venue_id);
  perform rebuild_resource_tree(vid);
  return coalesce(new, old);
end;
$$;

drop trigger if exists resource_tree_aiud on resource;
create trigger resource_tree_aiud
after insert or update of parent_id, venue_id or delete
on resource
for each row execute function trg_resource_tree();

create or replace function conflict_set(p_resource_id text)
returns table(id text)
language sql
stable
as $$
  select ancestor_id from resource_tree where descendant_id = p_resource_id
  union
  select descendant_id from resource_tree where ancestor_id = p_resource_id;
$$;

create or replace function turf_create_booking(
  p_id text,
  p_ref_code text,
  p_venue_id text,
  p_resource_id text,
  p_identity_id text,
  p_profile_id text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_blocked_start timestamptz,
  p_blocked_end timestamptz,
  p_local_date date,
  p_state text,
  p_channel text,
  p_price_paise integer,
  p_discount_paise integer,
  p_loyalty_redeemed_paise integer,
  p_amount_due_paise integer,
  p_amount_collected_paise integer,
  p_payment_mode text,
  p_payment_note text,
  p_promo_code_id text,
  p_policy_snapshot jsonb,
  p_request_expires_at timestamptz,
  p_created_by text,
  p_client_request_id text
) returns table(ok boolean, error text, booking_id text)
language plpgsql
as $$
declare
  overlap_id text;
  org_status text;
begin
  if p_client_request_id is not null then
    select b.id into overlap_id from booking b where b.client_request_id = p_client_request_id;
    if overlap_id is not null then
      return query select true, null::text, overlap_id;
      return;
    end if;
  end if;

  select o.status into org_status
  from venue v join org o on o.id = v.org_id
  where v.id = p_venue_id;
  if org_status in ('read_only','cancelled') then
    return query select false, 'ORG_READ_ONLY', null::text;
    return;
  end if;

  perform r.id from resource r
  where r.id in (select cs.id from conflict_set(p_resource_id) cs)
  order by r.id
  for update;

  if p_state in ('confirmed','checked_in') then
    select b.id into overlap_id
    from booking b
    where b.resource_id in (select cs.id from conflict_set(p_resource_id) cs)
      and b.state in ('confirmed','checked_in')
      and b.blocked_start < p_blocked_end
      and b.blocked_end > p_blocked_start
    limit 1;
    if overlap_id is not null then
      return query select false, 'SLOT_UNAVAILABLE', null::text;
      return;
    end if;
  else
    -- requested: still refuse if a confirmed booking already owns the slot
    select b.id into overlap_id
    from booking b
    where b.resource_id in (select cs.id from conflict_set(p_resource_id) cs)
      and b.state in ('confirmed','checked_in')
      and b.blocked_start < p_blocked_end
      and b.blocked_end > p_blocked_start
    limit 1;
    if overlap_id is not null then
      return query select false, 'SLOT_UNAVAILABLE', null::text;
      return;
    end if;
  end if;

  insert into booking (
    id, ref_code, venue_id, resource_id, identity_id, profile_id,
    period_start, period_end, blocked_start, blocked_end, local_date,
    state, channel, price_paise, discount_paise, loyalty_redeemed_paise,
    amount_due_paise, amount_collected_paise, payment_mode, payment_note,
    promo_code_id, policy_snapshot, request_expires_at, created_by, client_request_id
  ) values (
    p_id, p_ref_code, p_venue_id, p_resource_id, p_identity_id, p_profile_id,
    p_period_start, p_period_end, p_blocked_start, p_blocked_end, p_local_date,
    p_state, p_channel, p_price_paise, p_discount_paise, p_loyalty_redeemed_paise,
    p_amount_due_paise, p_amount_collected_paise, p_payment_mode, p_payment_note,
    p_promo_code_id, p_policy_snapshot, p_request_expires_at, p_created_by, p_client_request_id
  );

  insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
  values (
    p_id, null, p_state, p_created_by,
    case when p_channel = 'link' then 'customer' else 'staff' end,
    'created'
  );

  if p_promo_code_id is not null then
    update promo_code set times_used = times_used + 1 where id = p_promo_code_id;
  end if;

  return query select true, null::text, p_id;
end;
$$;

create or replace function turf_accept_booking(
  p_booking_id text,
  p_actor_id text,
  p_actor_type text,
  p_amount_collected_paise integer,
  p_payment_mode text,
  p_payment_note text
) returns table(ok boolean, error text, booking_id text)
language plpgsql
as $$
declare
  b record;
  overlap_id text;
  other record;
begin
  select * into b from booking where id = p_booking_id for update;
  if not found then
    return query select false, 'NOT_FOUND', null::text;
    return;
  end if;
  if b.state <> 'requested' then
    return query select false, 'INVALID_STATE', null::text;
    return;
  end if;

  perform r.id from resource r
  where r.id in (select cs.id from conflict_set(b.resource_id) cs)
  order by r.id
  for update;

  select x.id into overlap_id
  from booking x
  where x.resource_id in (select cs.id from conflict_set(b.resource_id) cs)
    and x.state in ('confirmed','checked_in')
    and x.blocked_start < b.blocked_end
    and x.blocked_end > b.blocked_start
    and x.id <> b.id
  limit 1;

  if overlap_id is not null then
    update booking
      set state = 'declined', cancel_reason = 'slot_taken', updated_at = now()
      where id = b.id;
    insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
    values (b.id, 'requested', 'declined', p_actor_id, p_actor_type, 'slot_taken');
    return query select false, 'SLOT_UNAVAILABLE', b.id;
    return;
  end if;

  update booking
    set state = 'confirmed',
        amount_collected_paise = coalesce(p_amount_collected_paise, amount_collected_paise),
        payment_mode = coalesce(p_payment_mode, payment_mode),
        payment_note = coalesce(p_payment_note, payment_note),
        updated_at = now()
    where id = b.id;

  insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
  values (b.id, 'requested', 'confirmed', p_actor_id, p_actor_type, 'accepted');

  for other in
    select x.id from booking x
    where x.resource_id in (select cs.id from conflict_set(b.resource_id) cs)
      and x.state = 'requested'
      and x.id <> b.id
      and x.blocked_start < b.blocked_end
      and x.blocked_end > b.blocked_start
    for update
  loop
    update booking
      set state = 'declined', cancel_reason = 'slot_taken', updated_at = now()
      where id = other.id;
    insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
    values (other.id, 'requested', 'declined', p_actor_id, 'system', 'slot_taken');
  end loop;

  return query select true, null::text, b.id;
end;
$$;

create or replace function turf_transition(
  p_booking_id text,
  p_to_state text,
  p_actor_id text,
  p_actor_type text,
  p_reason text
) returns table(ok boolean, error text, booking_id text)
language plpgsql
as $$
declare
  b record;
  allowed boolean := false;
begin
  select * into b from booking where id = p_booking_id for update;
  if not found then
    return query select false, 'NOT_FOUND', null::text;
    return;
  end if;

  if b.state = 'requested' and p_to_state in ('declined','lapsed') then allowed := true; end if;
  if b.state = 'confirmed' and p_to_state in ('checked_in','cancelled','no_show') then allowed := true; end if;
  if b.state = 'checked_in' and p_to_state in ('completed','no_show') then allowed := true; end if;

  if not allowed then
    return query select false, 'INVALID_STATE', b.id;
    return;
  end if;

  -- no_show is staff-marked only (caller enforces actor_type)
  update booking
    set state = p_to_state,
        updated_at = now(),
        cancelled_at = case when p_to_state in ('cancelled','declined','lapsed') then now() else cancelled_at end,
        cancelled_by = case when p_to_state in ('cancelled','declined') then p_actor_id else cancelled_by end,
        cancel_reason = coalesce(p_reason, cancel_reason),
        checked_in_at = case when p_to_state = 'checked_in' then now() else checked_in_at end,
        checked_out_at = case when p_to_state = 'completed' then now() else checked_out_at end
    where id = b.id;

  insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
  values (b.id, b.state, p_to_state, p_actor_id, p_actor_type, p_reason);

  return query select true, null::text, b.id;
end;
$$;
