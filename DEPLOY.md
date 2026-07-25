# Deploy

Two providers. Every command below runs from the **repo root**.

| Component       | Where                       | Deployed by                      |
| --------------- | --------------------------- | -------------------------------- |
| `apps/api`      | Cloudflare Workers          | `pnpm deploy:api`                |
| Payload tables  | Cloudflare D1               | `D1` binding + `db:setup:remote` |
| Media uploads   | Cloudflare R2               | `R2` binding                     |
| `apps/frontend` | Render (web, Docker)        | `render.yaml`                    |
| `apps/agent`    | Render (web, Docker)        | `render.yaml`                    |
| Evolution API   | Render (web, image)         | `render.yaml`                    |
| Evolution state | Render Postgres + Key Value | `render.yaml`                    |

`wrangler` is a dev dependency, so it needs no global install — the `pnpm cf:*`
scripts call the pinned one. The **Render CLI is a separate binary** you install
yourself (`brew install render` or the tarball from render.com/docs/cli); only
`pnpm deploy:render`, `pnpm render:*` and `pnpm verify:render` need it.

## Verify before you deploy

Nothing here contacts a provider except `verify:health`.

```bash
pnpm verify:env        # is .env complete for local dev?
pnpm verify:env:prod   # is .env.production complete enough to deploy?
pnpm verify            # the above plus lint + tests
pnpm verify:build      # real production builds: Worker bundle + frontend Next build
pnpm verify:render     # render.yaml passes Render's own Blueprint validation
pnpm verify:docker     # both Render images actually build (slow)
pnpm preview:api       # run the Worker bundle locally in workerd
pnpm verify:health     # ping every deployed service, after a deploy
```

`pnpm verify:build` is the one that catches most deploy failures, because it runs
exactly what Cloudflare and Render run.

## First deploy

### 1. Fill in `.env.production`

```bash
cp .env.production.sample .env.production
```

This one gitignored file drives the Cloudflare side. Leave the URL entries as
placeholders for now — you only learn them after the first deploy of each side.

### 2. Create the Cloudflare resources

```bash
pnpm cf:login
pnpm cf:create     # d1 create imno-production + r2 bucket create imno-media
```

Copy the printed `database_id` into the `production` environment of
`apps/api/wrangler.jsonc`, replacing `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`. A
D1 id is an identifier, not a secret, so it is committed.

### 3. Deploy the Worker

```bash
pnpm cf:secrets    # pushes the 9 Worker vars from .env.production
pnpm deploy:api    # opennext build + wrangler deploy --env production
pnpm db:setup:remote   # applies Payload migrations to the deployed D1
pnpm db:seed:remote    # optional demo dataset
```

The Worker prints its URL. Put it in `.env.production` as `API_URL`, and set
`EVOLUTION_WEBHOOK_URL=<worker-url>/api/webhooks/evolution`.

Re-run `pnpm db:setup:remote` after every migration you add — migrations never
run on boot.

### 4. Create the Render Blueprint

Blueprint creation is dashboard-only (the CLI can deploy existing services but
not create a Blueprint): **New > Blueprint**, point it at this repo, and Render
reads `render.yaml`. It prompts for every `sync: false` value:

| Prompted                   | Value                                                     |
| -------------------------- | --------------------------------------------------------- |
| `API_URL`                  | The Worker URL from step 3                                |
| `INTERNAL_SERVICE_SECRET`  | Same value as in `.env.production`                        |
| `EVOLUTION_API_KEY`        | Same value as in `.env.production`                        |
| `EVOLUTION_WEBHOOK_SECRET` | Same value as in `.env.production`                        |
| `EVOLUTION_WEBHOOK_URL`    | `<worker-url>/api/webhooks/evolution`                     |
| `AUTHENTICATION_API_KEY`   | Evolution's own name for `EVOLUTION_API_KEY` — same value |
| `LLM_API_KEY`              | Model provider key                                        |

Everything else is derived: `APP_URL`, `AGENT_INTERNAL_URL` and
`EVOLUTION_BASE_URL` come from the services' own Render URLs, and Evolution's
Postgres and Redis URLs come from the resources in the same Blueprint.

### 5. Close the loop

Put the Render URLs into `.env.production` (`APP_URL`, `AGENT_INTERNAL_URL`,
`EVOLUTION_BASE_URL`, `EVOLUTION_PUBLIC_URL`), then:

```bash
pnpm verify:env:prod
pnpm cf:secrets && pnpm deploy:api   # the Worker now knows where the agent is
pnpm verify:health
```

### 6. Connect WhatsApp

Open the `imno-evolution` URL for its manager UI (the API key protects it) and
pair an instance from `/app/:tenantSlug/settings/integrations`. Evolution's
webhook must point at the Worker, not at Render.

## Redeploying

```bash
pnpm deploy:api        # Cloudflare
pnpm deploy:render     # interactive service picker; or `render deploys create srv-…`
pnpm cf:logs           # wrangler tail
pnpm render:logs
```

## Things worth knowing

- **The agent is a public Render service, not a private one.** The API calls it
  from the WhatsApp webhook, and the API runs on Cloudflare, which has no route
  into Render's private network. Every agent endpoint verifies an HMAC signature
  made with `INTERNAL_SERVICE_SECRET`, so that shared secret is the only thing
  protecting it — use a real 32-byte random value.
- **`compatibility_date` in `wrangler.jsonc` cannot go below 2025-08-15.** React
  19's server renderer, which the Payload admin panel goes through, needs the
  global `MessageChannel`/`MessagePort` that workerd only exposes from that date.
  Lowering it makes `/admin` fail with `MessagePort is not defined`.
- **No `sharp` on Workers.** It is a native binary, so Payload runs without it
  and uploads are stored in R2 at their original size. No collection declares
  `imageSizes`, so nothing regressed; add Cloudflare Images at read time if you
  ever need variants.
- **`limits.cpu_ms` needs a paid Workers plan.** Delete that block from the
  `production` environment to deploy on the free plan with the 30s ceiling.
- **The frontend bakes `API_URL` at build time** for its `/api/admin` rewrite.
  Render injects env vars as Docker build args, so it works there; locally pass
  `--build-arg API_URL=…` (that is what `pnpm verify:docker` does).
- **Free Postgres expires after 30 days.** Evolution's database is on the free
  plan; move it to a paid one if the deployment should outlive the hackathon.
- **Agent memory lives on a disk.** `imno-agent` mounts 1 GB at `/data` for its
  libSQL thread store. Drop the `disk:` block to make it ephemeral.
- **Evolution media is ephemeral.** Sessions are in Postgres and Redis, but files
  Evolution writes into its own container are lost on redeploy.

## Unused variables

The old sample carried variables nothing reads. `loadApiConfig`,
`loadVideoConfig` and `loadDeferredMediaConfig` are exported by
`@imno/runtime-config` but never called, so `CLOUDFLARE_D1_BINDING`,
`CLOUDFLARE_R2_BINDING`, `VIDEO_*`, `TRANSCRIPTION_PROVIDER`, `VOICE_PROVIDER`
and `IMAGE_ENHANCEMENT_PROVIDER` are gone from `.env.sample`; the binding names
are hardcoded as `D1`/`R2` in `payload.config.ts`. `NEXT_PUBLIC_API_URL` is gone
too: it is only a server-side fallback for `API_URL`, and exposing it to the
browser buys nothing. `tools/deploy/targets.mjs` is the list that is actually
checked, so keep it in sync when a service starts reading something new.
