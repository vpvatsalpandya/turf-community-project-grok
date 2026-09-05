# Turf Community

The booking book, retired. Night-running turf booking for India — Vadodara first.

Live: [https://turf-community.vercel.app](https://turf-community.vercel.app)

## What ships

- Public directory of every listed Vadodara turf, box-cricket and pickleball ground — onboarded desks highlighted
- Guest booking on a shareable `/b/:slug` link (20-minute UPI hold, no wallet)
- Owner / manager / staff desk: walk-in, confirm, decline, check-in, check-out, no-show, cancel, tap-to-call, WhatsApp
- Team logins per turf (owner adds staff and manager)
- Automatic WhatsApp once an owner pastes Cloud API or Green API keys on Share
- UPI out-of-band (QR + deep link, no payment gateway)
- PWA, academy, terms and privacy
- Sign up is an owner desk. Players book as guests.

## Roles

| Role | Home | Can do |
| --- | --- | --- |
| Player | `/play` | Own requests |
| Staff | `/desk` | Tonight’s board only |
| Manager | `/desk` | Board + share link |
| Owner | `/desk` | Turf, UPI, photos, team, WhatsApp keys |
| Admin | `/admin` | Every live turf |

## Production env (Vercel)

Set these on the `turf-community` project. Never commit them.

| Key | Why |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (pooled). Without it, bookings do not persist. |
| `BETTER_AUTH_SECRET` | 32+ random chars. Session signing. |
| `BETTER_AUTH_URL` | `https://turf-community.vercel.app` |
| `TURF_DEMO` | Leave unset. Set `1` only if you want the public demo desks. |

WhatsApp Cloud / Green API keys are pasted by each owner on the desk Share tab — not env.

## Stack

TanStack Start, Better Auth (email + Grok), Neon Postgres, Vercel.
