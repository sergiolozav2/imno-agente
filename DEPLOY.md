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

## Where env vars live

There are exactly **two** env files, both at the repo root, both gitignored:

| File              | Read by                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `.env`            | everything you run locally (`pnpm dev`, `db:*`, `verify:env`)            |
| `.env.production` | the deploy scripts only (`cf:secrets`, `db:*:remote`, `verify:env:prod`) |

**Per-app env files are a trap.** `apps/agent/.env` and friends are never
loaded: the agent calls no `dotenv`, it only reads `process.env`, and Nx injects
the _root_ `.env` into every task it runs. A key placed there is silently
ignored, and `pnpm verify:env` — which parses the root `.env` and nothing else —
will keep reporting it as a placeholder. (`apps/frontend/.env.local` is the lone
exception, since Next.js loads it natively, but it only duplicates the root file
and is one more place for values to drift.) So
`LLM_API_KEY` goes in the root `.env` even though only the agent reads it; the
same is true of every variable in `tools/deploy/targets.mjs`.

Values still reading `replace-with-…` count as unset. That prefix is exactly
what the verifier looks for, so a real value never trips it.

On Render nothing reads these files at all — the Blueprint prompts supply the
values (see step 4).

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

Two sides need each other's URLs, and neither URL exists until that side is
deployed, so **the first deploy of each side is throwaway** — you deploy to learn
the URL, write it down, then redeploy. Nothing breaks in between; the services
just answer 500 until the loop is closed. Order below is the one with the fewest
round trips.

### 1. Fill in `.env.production`

```bash
cp .env.production.sample .env.production
pnpm cf:login       # OAuth token; this is instead of CLOUDFLARE_API_TOKEN
pnpm cf:whoami      # copy the account id into CLOUDFLARE_ACCOUNT_ID
openssl rand -hex 32   # once each for the four secrets below
```

Fill in everything except the six URL entries (`API_URL`, `APP_URL`,
`AGENT_INTERNAL_URL`, `EVOLUTION_BASE_URL`, `EVOLUTION_PUBLIC_URL`,
`EVOLUTION_WEBHOOK_URL`) and leave those on `replace-with-…`. The secrets are
`PAYLOAD_SECRET`, `INTERNAL_SERVICE_SECRET`, `EVOLUTION_API_KEY` and
`EVOLUTION_WEBHOOK_SECRET`; `LLM_API_KEY` is your model provider's key.

### 2. Create the Cloudflare resources

```bash
pnpm cf:create     # d1 create imno-production + r2 bucket create imno-media
```

Copy the printed `database_id` into the `production` environment of
`apps/api/wrangler.jsonc`. A D1 id is an identifier, not a secret, so it is
committed.

Wrangler then offers to add the binding to your config **for you — say no**, or
undo it afterwards. It suggests binding names taken from the resource
(`imno_production`, `imno_media`) and appends them to the _top level_ of
`wrangler.jsonc`, which is the local-dev section. `payload.config.ts` looks up
the bindings named exactly `D1` and `R2`, so the added entries are dead weight
that only makes the file look like local dev points at production.

### 3. Deploy the Worker to learn its URL

`pnpm cf:secrets` refuses to run while any Worker variable is still a
placeholder, so skip it on this first pass — the deploy itself does not need the
secrets:

```bash
pnpm deploy:api    # opennext build + wrangler deploy --env production
```

The output ends with the Worker URL, `https://imno-api.<subdomain>.workers.dev`.
Put it in `.env.production` as `API_URL` and set
`EVOLUTION_WEBHOOK_URL=<worker-url>/api/webhooks/evolution`.

### 4. Create the Render Blueprint

Blueprint creation is dashboard-only (the CLI can deploy existing services but
not create a Blueprint): **New > Blueprint**, point it at this repo, and Render
reads `render.yaml`.

**Render only prompts for `sync: false` variables declared on a _service_, not
for the ones inside `envVarGroups`.** The creation screen therefore asks for
exactly two values:

| Prompted on the creation screen           | Value                                                     |
| ----------------------------------------- | --------------------------------------------------------- |
| `AUTHENTICATION_API_KEY` (imno-evolution) | Evolution's own name for `EVOLUTION_API_KEY` — same value |
| `EVOLUTION_WEBHOOK_URL` (imno-frontend)   | `<worker-url>/api/webhooks/evolution`                     |

The five `sync: false` entries in the `imno-shared` group are created **empty and
without asking**, and an empty variable is exactly what the services treat as
missing. So immediately after the Blueprint is created, go to **Env Groups >
imno-shared** and fill in:

| In the `imno-shared` group | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| `API_URL`                  | The Worker URL from step 3                              |
| `INTERNAL_SERVICE_SECRET`  | Same value as in `.env.production`                      |
| `EVOLUTION_API_KEY`        | Same value as in `.env.production`                      |
| `EVOLUTION_WEBHOOK_SECRET` | Same value as in `.env.production`                      |
| `LLM_API_KEY`              | Model provider key — same value as in `.env.production` |

Saving the group redeploys `imno-agent` and `imno-frontend`, which consume it.
Skip this and `imno-agent` dies on boot with `CONFIG_INVALID
INTERNAL_SERVICE_SECRET` — that is the first name in its required list, so it is
the symptom you get for an entirely empty group, not a problem with that one
variable.

If you would rather create the Blueprint before the Worker exists, any syntactic
URL works as a stand-in (`https://placeholder.invalid` and
`https://placeholder.invalid/api/webhooks/evolution`) — every value here is a
plain environment variable you can edit later. Nothing validates them at create
time; the WhatsApp webhook simply won't deliver until they are right.

The Blueprint hardcodes the other `LLM_*` entries (`default`, `deepseek-v4-pro`,
`https://api.deepseek.com`), so if you change `LLM_MODEL` in `.env` you have to
change it in `render.yaml` too — nothing syncs them.

Everything else is derived and is _not_ prompted, which is why the plan screen
lists `SERVER_URL`, `APP_URL` and `AGENT_INTERNAL_URL` as variables it will
create on its own: those come from each service's `RENDER_EXTERNAL_URL`, and
Evolution's Postgres and Redis URLs come from the resources in the same
Blueprint.

### 5. Close the loop

The three Render services are `https://imno-<name>.onrender.com` unless the name
was already taken globally, in which case Render appends a suffix — copy the real
ones off the dashboard. Put them into `.env.production` (`APP_URL`,
`AGENT_INTERNAL_URL`, `EVOLUTION_BASE_URL`, `EVOLUTION_PUBLIC_URL`), then:

```bash
pnpm verify:env:prod                 # now passes: no placeholders left
pnpm cf:secrets && pnpm deploy:api   # the Worker now knows where the agent is
pnpm db:setup:remote                 # applies Payload migrations to the deployed D1
pnpm db:seed:remote                  # optional demo dataset
pnpm verify:health
```

Re-run `pnpm db:setup:remote` after every migration you add — migrations never
run on boot.

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

- **Local dev never touches production D1/R2, but the `:remote` scripts do.**
  `pnpm dev` uses the top-level bindings in `wrangler.jsonc`, which are the
  emulated local database and bucket under `apps/api/.wrangler`. The
  `db:*:remote` scripts read `.env.production`, so `CLOUDFLARE_ENV=production`
  selects the `production` environment whose bindings are marked `"remote": true`
  — wrangler proxies those to the real deployed D1 and R2 from your laptop. That
  is how the deployed database gets migrated, and it is also why you should not
  point local dev at the remote resources: `next dev` would then write to
  production on every hot reload.
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
