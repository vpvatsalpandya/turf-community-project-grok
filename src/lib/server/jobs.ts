import type { Sql } from "@/lib/db";

/** Replaces pg_cron. Runs at the start of mutating/list requests. */
export async function runJobs(sql: Sql): Promise<void> {
  // Expire open requests
  const lapsed = await sql<{ id: string }>`
    update booking
       set state = 'lapsed', updated_at = now(), cancelled_at = now(), cancel_reason = coalesce(cancel_reason, 'expired')
     where state = 'requested'
       and request_expires_at is not null
       and request_expires_at < now()
     returning id`;
  for (const row of lapsed) {
    await sql`
      insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
      values (${row.id}, 'requested', 'lapsed', null, 'system', 'expired')`;
  }

  // Auto-complete checked-in bookings 2h after period end
  const done = await sql<{ id: string }>`
    update booking
       set state = 'completed',
           checked_out_at = coalesce(checked_out_at, period_end),
           updated_at = now()
     where state = 'checked_in'
       and period_end + interval '2 hours' < now()
     returning id`;
  for (const row of done) {
    await sql`
      insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
      values (${row.id}, 'checked_in', 'completed', null, 'system', 'auto_complete')`;
  }

  // Flag no-show *candidates* — never auto-mark
  await sql`
    insert into noshow_flag (id, booking_id)
    select 'ns_' || id, id from booking
     where state = 'confirmed'
       and period_start + interval '20 minutes' < now()
       and checked_in_at is null
       and not exists (select 1 from noshow_flag n where n.booking_id = booking.id)
    on conflict do nothing`;

  // Drop expired holds
  await sql`delete from slot_hold where expires_at < now()`;

  await sql`delete from otp_challenge where expires_at < now() - interval '1 day'`;

  // Trial → past_due → read_only (never hard-lock mid-weekend: read_only keeps calendar)
  await sql`
    update org o
       set status = 'past_due'
     from subscription s
    where s.org_id = o.id
      and o.status = 'trialing'
      and s.trial_ends_on is not null
      and s.trial_ends_on < current_date
      and s.referred = true`;
  await sql`
    update org o
       set status = 'active'
     from subscription s
    where s.org_id = o.id
      and o.status = 'trialing'
      and s.trial_ends_on is not null
      and s.trial_ends_on < current_date
      and s.referred = false`;
  await sql`
    update org o
       set status = 'past_due'
      where o.status = 'active'
        and exists (
          select 1 from invoice i
           where i.org_id = o.id and i.status in ('due','overdue')
             and i.period_end < current_date - 7
        )`;
  await sql`
    update org o
       set status = 'read_only'
      where o.status = 'past_due'
        and exists (
          select 1 from invoice i
           where i.org_id = o.id and i.status in ('due','overdue')
             and i.period_end < current_date - 14
        )`;

  // 60-day referral clawback — void before payout if they churned
  await sql`
    update referral r
       set status = 'void', flagged_reason = coalesce(r.flagged_reason, 'clawback_60d')
      from org o
     where o.id = r.referred_org_id
       and r.status in ('qualified','payout_due')
       and r.qualified_at > now() - interval '60 days'
       and o.status in ('past_due','cancelled','read_only')`;

  await sql`
    update referral r
       set flagged_reason = coalesce(r.flagged_reason, 'volume')
     where r.flagged_reason is null
       and r.code in (select code from referral group by code having count(*) >= 5)`;

  await sql`
    update referral r
       set flagged_reason = coalesce(r.flagged_reason, 'phone_match')
      from referral_code c, org o, app_user u
     where c.code = r.code
       and o.id = r.referred_org_id
       and u.org_id = o.id
       and r.flagged_reason is null
       and u.phone is not null
       and u.phone <> ''
       and u.phone = c.referrer_phone`;
}
