# Turf Community

Night floodlit 5-a-side turf booking for India. Owners share a link. Players request a slot. Payment is UPI out of band — no gateway.

**Tagline:** The booking book, retired.

## What it does

- **Public booking** (`/v/:slug`) — pick a date and slot, send a request
- **Owner desk** (`/app`) — confirm or decline after UPI lands
- **Demo turf** (`/v/greenfield`) — try the flow without signing up
- Times are **IST**. Two people cannot hold the same hour.

Phase 1 is built for a solo owner: no payment gateway, no customer accounts, no in-app chat.

## Stack

TanStack Start · Better Auth · Postgres (Neon in production, PGLite locally) · Tailwind v4 · PWA

Palette: `#07110c` night turf, `#3dcf8a` floodlight green, `#e8f2eb` foreground.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

| Path | Who |
|---|---|
| `/` | Landing |
| `/v/greenfield` | Public booking (demo venue) |
| `/login` | Owner sign in / sign up |
| `/app` | Owner desk |

Production needs `DATABASE_URL` (Postgres) plus Better Auth secrets. Do not commit `.env`.

## Brand

Custom OG card, hand-authored pitch favicon, and PWA icons live in `public/`. Identity is in `src/lib/og/site.json`.
