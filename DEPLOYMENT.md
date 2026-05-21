# CIRIS Review — Production Deployment

End-to-end guide to ship CIRIS Review to production on Vercel, with Postgres
(Neon / Supabase / Vercel Postgres), Cloudflare R2 for image storage, and
Resend for transactional email.

The dev stack (SQLite + local FS + console email) keeps working unchanged —
this guide only flips the three swappable adapters.

---

## 1. Provision the external services

### 1a. Postgres database
Pick one — all three work, the cheapest free tier is fine to start:

- **Neon** (recommended) — `neon.tech`, generous free tier, instant branching.
- **Supabase** — `supabase.com`, also offers auth/storage you won't need.
- **Vercel Postgres** — easiest integration but pricier past free tier.

Grab the **pooled** connection string (Neon: "Pooled connection";
Supabase: "Transaction pooler"). You want the pooled URL because Next.js
serverless functions on Vercel spin up many short-lived connections.

```
DATABASE_URL=postgres://user:pass@host/dbname?sslmode=require
```

### 1b. Cloudflare R2 (image storage)
R2 has no egress fees — ideal for serving image previews.

1. Sign up at `dash.cloudflare.com`.
2. **R2 → Create bucket** → name it `ciris-review` (or similar).
3. **R2 → Manage R2 API Tokens → Create API token**:
   - Permissions: **Object Read & Write**
   - Bucket: the bucket you just made
   - Copy the **Access Key ID**, **Secret Access Key**, and the **S3 API
     endpoint** (`https://<accountid>.r2.cloudflarestorage.com`).

You will set these as env vars in step 3:

```
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ciris-review
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
```

> AWS S3, MinIO, and Backblaze B2 also work — same envs, just point
> `S3_ENDPOINT` at the right host (or omit it for AWS S3 default).

### 1c. Resend (transactional email)
1. Sign up at `resend.com`.
2. Add and verify your sending domain (e.g. `mail.ciris.studio`) — you'll
   set TXT/MX records at your DNS provider. Verification takes ~5 minutes.
3. **API Keys → Create API Key** with **Sending access** → copy the key.

```
RESEND_API_KEY=re_…
EMAIL_FROM=CIRIS Review <noreply@mail.ciris.studio>
EMAIL_REPLY_TO=sam@chapter103.com    # optional
```

Without `RESEND_API_KEY` the app falls back to logging emails to stdout,
which is fine for dev but means **nothing actually sends** in prod —
double-check this is set.

---

## 2. Push the schema to Postgres

Local one-time setup against the prod DB:

```bash
# Switch the schema file to postgres
npm run db:use-postgres

# Push the schema to the prod database
DATABASE_URL='postgres://…' npx prisma db push

# (Optional) seed a starter org + admin user
DATABASE_URL='postgres://…' npm run db:seed

# Switch the local schema back to sqlite so dev still works
npm run db:use-sqlite
```

The swap script (`scripts/swap-db-provider.mjs`) rewrites the one
`provider = "…"` line in `prisma/schema.prisma`. It's idempotent — running
the same target twice is a no-op.

> Future schema changes: edit `schema.prisma` while it's set to `sqlite`,
> `npm run db:push` locally to test, then before deploying run
> `npm run db:use-postgres && DATABASE_URL=… npx prisma db push` and switch
> back. Vercel's build runs `build:prod` which handles the swap for the
> client generation step automatically — see step 3.

---

## 3. Deploy to Vercel

### 3a. Connect the repo
1. Push the repo to GitHub.
2. `vercel.com` → **Add New Project** → import the repo.
3. **Framework Preset:** Next.js (auto-detected).
4. **Build Command:** override to `npm run build:prod`
   — this runs the provider swap before `prisma generate` so the Prisma
   client is generated for Postgres.
5. **Install Command:** leave default (`npm install`).
6. **Root Directory:** leave default (`./`).

### 3b. Environment variables
In Vercel → **Settings → Environment Variables** add all of these to
**Production** (and to **Preview** if you want preview deploys to be
live too):

```
# App
APP_URL=https://review.ciris.studio
AUTH_SECRET=<openssl rand -hex 32>

# Database
DATABASE_URL=postgres://user:pass@host/dbname?sslmode=require

# Storage
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ciris-review
S3_ACCESS_KEY=…
S3_SECRET_KEY=…

# Email
RESEND_API_KEY=re_…
EMAIL_FROM=CIRIS Review <noreply@mail.ciris.studio>
EMAIL_REPLY_TO=sam@chapter103.com
```

**Critical:** `AUTH_SECRET` must be a strong random string. Generate
with `openssl rand -hex 32`. If it changes, all existing sessions are
invalidated.

`APP_URL` must match the public URL exactly (no trailing slash) — it's
used to build magic-link URLs in emails. Use your custom domain, not the
`*.vercel.app` URL.

### 3c. Custom domain
1. Vercel → **Settings → Domains** → add `review.ciris.studio`.
2. At your DNS provider, add the CNAME record Vercel shows you.
3. Update `APP_URL` to the custom domain and redeploy.

### 3d. Deploy
Push to your main branch (or click **Deploy** in Vercel). The first deploy
runs `prisma generate` against the Postgres schema and builds Next.js.

---

## 4. First-run verification

Once deployed, walk through the smoke test:

1. **Login flow.** Go to `https://review.ciris.studio/login`, enter your
   email. Check that the magic-link email arrives via Resend (not the
   server log). Click the link → you should land in the app authenticated.
2. **Upload.** Create a project, upload 2–3 images. Verify they render in
   the gallery. In the R2 console, confirm objects exist under
   `projects/<projectId>/preview/` and `…/thumb/`.
3. **Review flow.** Open an image, leave a comment with an annotation,
   submit a round. Verify the digest email arrives at the admin / post-prod
   address.
4. **Share link.** Create a share link, open it in a private window.
   Verify it loads without auth and that originals are NOT downloadable
   (preview/thumb only).
5. **Settings drawer.** Toggle watermark, change name, archive a test
   project. Verify the audit log captures these.

---

## 5. Operational notes

### 5a. Database connection limits
Postgres providers have connection caps. The pooled URL helps but if you
see `too many clients` errors, set Prisma's connection limit:

```
DATABASE_URL=postgres://…?sslmode=require&connection_limit=5
```

### 5b. Storage migration (local → R2)
If you've been running locally and accumulated images, sync them up before
flipping `STORAGE_PROVIDER`:

```bash
# Install AWS CLI, configure with the R2 credentials as an S3 profile
aws s3 sync ./data/projects s3://ciris-review/projects \
  --endpoint-url https://<accountid>.r2.cloudflarestorage.com
```

Keys mirror local paths verbatim (`projects/<id>/preview/<file>.webp`), so
the sync is a straight copy.

### 5c. Backups
- **Postgres**: Neon/Supabase do automatic daily backups. Verify retention
  in their dashboard.
- **R2**: enable **Object Versioning** on the bucket if you want
  recoverable deletes. Otherwise project-delete is permanent.

### 5d. Monitoring
Vercel surfaces logs and errors under **Logs** and **Observability**. For
email deliverability, watch Resend's **Logs** tab for bounces.

### 5e. Secrets rotation
- `AUTH_SECRET` rotation logs everyone out — only do it if you suspect
  compromise. Schedule a maintenance window.
- `RESEND_API_KEY` and `S3_*` can rotate without user impact: add the new
  value to Vercel, redeploy, then revoke the old key.

---

## 6. Rollback

If a deploy breaks:

1. Vercel → **Deployments** → find the last good one → **Promote to
   Production**. Instant rollback.
2. If a schema migration broke things, you'll also need to manually revert
   the Postgres schema. Always do schema changes in a separate PR from
   code changes so you can roll them back independently.

---

## 7. Cost ballpark (small studio, low volume)

| Service     | Tier                | Cost                |
|-------------|---------------------|---------------------|
| Vercel      | Hobby or Pro        | $0 / $20 mo         |
| Neon        | Free tier           | $0 (up to 0.5 GB)   |
| Cloudflare R2 | First 10 GB free  | $0.015/GB after     |
| Resend      | Free tier           | $0 (3k emails/mo)   |
| Domain      | namecheap, etc.     | ~$12/yr             |

Real-world: expect $0–25/month until you have multiple active studios on
the platform.
