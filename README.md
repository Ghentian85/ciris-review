# CIRIS Review

Visual production review & approval for fashion, lookbook, campaign and e-commerce shoots. Module 2 of the CIRIS Studio platform — currently standalone, designed to merge into the umbrella later.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma ORM, SQLite (dev) — switch provider to `postgresql` for prod
- Sharp for image derivatives
- Tailwind CSS + Radix UI primitives
- Local filesystem storage in `./data` (signed URL / R2 swap later)
- Magic-link auth (Resend in prod; console-logged dev links if no API key)

## Week-1 status

What ships right now:

- Magic-link sign in (dev mode shows the link inline, no email config required)
- Org + project + client + member CRUD
- Project dashboard, project overview, invite flow
- Full Prisma schema (organizations → projects → galleries → images → versions → annotations → comments → rounds → audit log)
- Design system: off-white / ink / status palette, status chips, surface components

Coming weeks 2–6 (see `analysis.md` in chat):

- Bulk upload + Sharp derivatives
- Image reviewer with SVG annotations (pin / rect → arrow / freehand)
- Status state machine + bulk approve / revise / kill
- Rounds, V2 upload, version compare
- Post-prod feedback inbox
- Final delivery area + ZIP export
- Batched Resend notifications

## Run it

```bash
cd ciris-review
npm install
npm run db:push      # apply Prisma schema to SQLite
npm run db:seed      # optional: creates Chapter 103 / AW26 Lookbook
npm run dev          # http://localhost:3001
```

On first sign-in:

1. Open `/login`
2. Enter your email — since no `RESEND_API_KEY` is set, the magic link prints in the dev server logs **and** appears inline on the success card
3. Click the link → you land on the dashboard, organization auto-bootstraps

To use real email later, set `RESEND_API_KEY` and `APP_URL` in `.env.local`.

## Layout

```
app/
  login/                    magic-link request
  invite/[token]/           invite acceptance
  projects/
    new/                    create project
    [slug]/                 overview
      settings/             members + invites
      upload/               (week 2)
      galleries/[id]/       gallery grid (week 2 wires images)
  work/                     post-prod cross-project queue (week 4)
  api/
    auth/{login,verify,logout}
    projects/               create
    projects/[id]/members   invite
components/
  ui/                       button, input, card, label, status-chip
  app/                      topbar
lib/
  auth.ts                   sessions + magic-link tokens (HMAC-signed cookies)
  email.ts                  Resend + dev console fallback
  storage.ts                Sharp derivatives, original/preview/thumb tiers
  prisma.ts, env.ts, utils.ts
prisma/
  schema.prisma             full data model
  seed.ts
data/                       runtime image storage (gitignored)
```

## Design tokens

| Token | Use |
|---|---|
| `--bg #FAFAF7` | page background |
| `--surface #FFF` | cards, panels |
| `--ink #111` | primary text, buttons |
| `--line #EAE8E2` | hairline borders |
| `--muted` | secondary text |
| `--status-*` | six review states (no aggressive red — terracotta for revisions) |

## Merging into CIRIS later

When merging into `ciris-studio`:

1. Add `review_` prefix to all tables that overlap with Module 1 names (none currently overlap by accident — `Project` here is distinct from `Project` there because they live in different schemas).
2. Promote `User` + `Organization` + `OrganizationMember` to a shared identity package.
3. Mount this app at `/review` inside the umbrella.

The auth, storage, and image-processing abstractions are deliberately thin so they can be replaced with whatever CIRIS Studio standardizes on.
