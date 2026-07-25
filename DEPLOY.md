# Deployment

The app is split across two providers. The Payload CMS / Next API runs on
Cloudflare Workers, next to the data it owns; the long-lived Node services and
the public web app run on Render.

| Component       | Where                       | How                                             |
| --------------- | --------------------------- | ----------------------------------------------- |
| `apps/api`      | Cloudflare Workers          | `@opennextjs/cloudflare`, native D1/R2 bindings |
| Payload tables  | Cloudflare D1               | `D1` binding                                    |
| Media uploads   | Cloudflare R2               | `R2` binding                                    |
| `apps/frontend` | Render (web)                | `apps/frontend/Dockerfile`                      |
| `apps/agent`    | Render (private)            | `apps/agent/Dockerfile`, tsx runtime            |
| Evolution API   | Render (web)                | `evoapicloud/evolution-api:v2.3.7` image        |
| Evolution state | Render Postgres + Key Value | Created by the Blueprint                        |

`render.yaml` describes every Render resource, so that half of the stack is
created in one pass with **New > Blueprint** in the Render dashboard. The Worker
is deployed separately with `pnpm deploy:api`.

## How the API gets its bindings

`D1Database` and `R2Bucket` only exist inside a Worker, which is why the API
lives there: `payload.config.ts` receives the real bindings and every query is an
in-process call rather than a network hop.

`src/cloudflare/index.ts` resolves them from the request context through
OpenNext's `getCloudflareContext()`. Two cases never have a request context, and
both are handled by standing up wrangler's platform proxy instead:

- `next dev` — `initOpenNextCloudflareForDev()` in `next.config.ts` attaches the
  emulated local D1/R2 under `apps/api/.wrangler`.
- CLI scripts (`db:setup`, `db:seed`, `db:reset`) — `initBindings()` opens the
  proxy for the script's own process. `CLOUDFLARE_ENV` selects local emulation or
  wrangler's **remote bindings** against the deployed database.

### What running on Workers costs

- **No `sharp`.** It is a native binary and cannot run on workerd, so Payload is
  configured without it. Uploads are stored in R2 at their original size and no
  resized variants are generated. No collection declares `imageSizes` today, so
  nothing regressed; if you add them later, generate the variants at read time
  with Cloudflare Images rather than reintroducing `sharp`.
- **CPU limits.** The `production` environment in `wrangler.jsonc` raises
  `limits.cpu_ms`, which requires a paid Workers plan. Remove that block to
  deploy on the free plan and accept the 30s ceiling.
- **`compatibility_date` cannot go below 2025-08-15.** React 19's server
  renderer, which the admin panel goes through, needs the global
  `MessageChannel`/`MessagePort` that workerd only exposes from that date on.
  Lowering it makes `/admin` fail with `MessagePort is not defined`.

## 1. Cloudflare resources

Create the production database and bucket, from `apps/api`:

```bash
pnpm --filter @imno/api exec wrangler d1 create imno-production
pnpm --filter @imno/api exec wrangler r2 bucket create imno-media
```

Put the printed `database_id` into the `production` environment in
`apps/api/wrangler.jsonc`, replacing `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`.
That file is committed: a D1 database id is an identifier, not a secret.

## 2. Worker secrets

Everything the Worker needs beyond its bindings is set as a secret or a plain
var. Non-secret values can go in a `vars` block in `wrangler.jsonc`; the rest:

```bash
cd apps/api
for k in PAYLOAD_SECRET INTERNAL_SERVICE_SECRET EVOLUTION_API_KEY \
         EVOLUTION_WEBHOOK_SECRET LLM_API_KEY; do
  pnpm exec wrangler secret put "$k" --env production
done
```

The API's config loader also requires `APP_URL`, `API_URL`,
`AGENT_INTERNAL_URL`, `CLOUDFLARE_ENV`, `CLOUDFLARE_D1_BINDING`,
`CLOUDFLARE_R2_BINDING` and the `EVOLUTION_*` origins. Several of those depend on
URLs that only exist after the first deploy of each side, so expect to set them
and redeploy once.

`INTERNAL_SERVICE_SECRET` must be the same value here and on the Render agent
service — every internal call is HMAC signed with it.

## 3. Deploy the Worker

```bash
pnpm deploy:api          # opennextjs-cloudflare build && deploy --env production
pnpm preview:api         # same bundle in local workerd, before deploying
```

## 4. Migrate the deployed database

Migrations never run on boot. Because wrangler can proxy the real bindings, the
same script works from a laptop: put the production values in a gitignored
`.env.production` at the repo root,

```
CLOUDFLARE_ENV=production
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
```

then run:

```bash
pnpm db:setup:remote     # applies pending Payload migrations
pnpm db:seed:remote      # optional demo dataset
```

The database and bucket themselves come from the `production` environment in
`wrangler.jsonc`, so they are never repeated as environment variables. Re-run
`pnpm db:setup:remote` after every migration you add.

## 5. Create the Render Blueprint

Point Render at this repo. It will prompt for every value marked `sync: false`,
including the ones that must agree with the Worker:

| Prompted variable         | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| `API_URL`                 | The Worker's public URL                                            |
| `NEXT_PUBLIC_API_URL`     | Same                                                               |
| `INTERNAL_SERVICE_SECRET` | Must match the Worker's secret                                     |
| `AUTHENTICATION_API_KEY`  | Evolution's key; set the same as `EVOLUTION_API_KEY` on the Worker |
| `LLM_API_KEY`             | Model provider key                                                 |

## 6. Connect WhatsApp

Open the Evolution service URL to reach its manager UI; it is protected by
`AUTHENTICATION_API_KEY`. Pair an instance from the app's
`/app/:tenantSlug/settings/integrations` page as usual. Evolution's webhook must
point at the Worker: `https://<worker-url>/api/webhooks/evolution`.

## Building the Render images locally

Both Dockerfiles take the **repo root** as their build context, because the apps
consume the `@imno/*` packages as TypeScript source:

```bash
docker build -f apps/frontend/Dockerfile -t imno-frontend .
docker build -f apps/agent/Dockerfile -t imno-agent .
```

## Things to know

- **Free Postgres expires.** The Blueprint provisions Evolution's database on the
  free plan, which Render deletes after 30 days. Move it to a paid plan before
  that if the deployment is meant to last.
- **Agent memory needs the disk.** `imno-agent` mounts a 1 GB disk at `/data` for
  its libSQL thread store. Remove the `disk:` block to make agent memory
  ephemeral (and the service free to scale).
- **Render services must not sleep.** Both Render web services use the `starter`
  plan on purpose: free web services spin down when idle.
- **Evolution media is ephemeral.** Sessions live in Postgres and Redis, but
  media files Evolution writes to its own container are lost on redeploy. Enable
  its S3 settings if that matters.
