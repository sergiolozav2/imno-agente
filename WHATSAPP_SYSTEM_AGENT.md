# System WhatsApp line

The platform has one WhatsApp number of its own — the line our real-estate
customers talk to us on, as opposed to the per-tenant lines their buyers talk to
them on. There is exactly one for the whole deployment, so it lives in a Payload
**global** (`system-whatsapp`) rather than in the `whatsapp-instances`
collection.

It is provisioned entirely from a shell. That is deliberate: the line does not
exist until someone scans a QR, so it cannot be configured through env vars, and
it is internal plumbing that does not deserve a UI.

## How it is stored

| Field                | Meaning                                                   |
| -------------------- | --------------------------------------------------------- |
| `instanceName`       | Evolution instance name, always prefixed `SYSTEM_`        |
| `externalInstanceId` | Evolution's own instance id                               |
| `apiKey`             | Instance-scoped Evolution token returned at creation time |
| `connectionState`    | `open` / `connecting` / `close`                           |
| `webhookConfigured`  | Whether the platform webhook was attached at creation     |
| `connectedNumber`    | Owner JID reported once the QR is scanned                 |
| `connectedAt`        | ISO timestamp of the successful pairing                   |

`SYSTEM_` is a hard prefix. The delete script refuses any name without it, so a
tenant line can never be removed by accident.

## Scripts

All three live in `apps/api/src/scripts` and are exposed from the root
`package.json`. Each has a `:remote` twin that reads `.env.production` and
targets the deployed D1 instead of the local Wrangler emulation.

| Command           | What it does                                                                           |
| ----------------- | -------------------------------------------------------------------------------------- |
| `pnpm wa:list`    | Lists every Evolution instance, `SYSTEM_*` first, next to what the database has stored |
| `pnpm wa:connect` | Creates the instance, prints the pairing QR in the terminal, waits, stores the result  |
| `pnpm wa:delete`  | Logs the phone out, deletes the instance, blanks the global                            |

### Prerequisites

`EVOLUTION_BASE_URL` and `EVOLUTION_API_KEY` must be set — the global admin key,
which is the only key Evolution accepts on `/instance/*`. Set
`EVOLUTION_WEBHOOK_URL` and `EVOLUTION_WEBHOOK_SECRET` too, otherwise the line is
created without a webhook: it can send but will never receive.

The `system_whatsapp` table and the inbound-routing columns ship as migrations,
so run `pnpm db:setup` (or `pnpm db:setup:remote`) once before the first
`wa:connect`.

## Setting it up over SSH

From a Render shell (or any box with the repo and `.env.production`):

```bash
pnpm db:setup:remote      # once, creates the system_whatsapp table
pnpm wa:list:remote       # see what exists today
pnpm wa:connect:remote    # provision + scan
```

`wa:connect` names the instance `SYSTEM_<EVOLUTION_INSTANCE_PREFIX>` — so
`SYSTEM_imno-agent` by default. Override it with an argument or the
`SYSTEM_WHATSAPP_INSTANCE` env var; the `SYSTEM_` prefix is added for you if you
leave it off:

```bash
pnpm wa:connect:remote SYSTEM_imno-support
```

Then:

1. The instance is created with the webhook attached and immediately written to
   the global as `connecting`, so a half-finished pairing is still visible.
2. A QR is rendered as text. Open WhatsApp on the phone that will own the line →
   **Settings → Linked devices → Link a device** → scan it. The code is
   reprinted every 20 seconds because WhatsApp expires it.
3. Once Evolution reports `open`, the script stores the token, the owner number
   and the timestamp, then exits. It gives up after three minutes — just re-run
   it.

Re-running against an already paired instance is safe: it reuses the instance
and refreshes what is stored.

To verify afterwards, `pnpm wa:list:remote` prints Evolution's view and the
database's view side by side and flags any disagreement.

## Replacing the line

```bash
pnpm wa:delete:remote     # targets the stored line, or the first SYSTEM_* one
pnpm wa:connect:remote
```

With no argument, `wa:delete` deletes whatever the global points at, falling
back to the first `SYSTEM_*` instance Evolution knows about. Pass a name to
target a specific one when several exist.

## How the agent uses it

Outbound sends go through the `whatsapp.send` data operation, which picks a line
in this order:

1. An instance name explicitly passed by the caller.
2. The tenant's own line from `whatsapp-instances`.
3. The system line — but only when it is stored as `open`.

So the system agent falls back to the platform line for tenants that have not
connected WhatsApp yet, with no configuration on the agent side. The agent's
legacy `.system-whatsapp.json` / `SYSTEM_WHATSAPP_INSTANCE` pin still overrides
step 1 when present locally; it is not needed in a deployment.

### Inbound

`POST /api/webhooks/evolution` serves both kinds of line. A tenant line names its
owner structurally — the instance is registered to exactly one agency — but the
platform line cannot, because every agency writes to the same number. So when an
event arrives on the system instance, identity comes from the sender instead,
resolved in `lib/operator-identity.ts`:

1. The number an operator registered on their user account (`users.whatsappPhone`,
   set from **Settings → Integraciones**). Deliberate, and works from a personal
   phone.
2. The number of the agency's own WhatsApp line
   (`whatsapp-instances.connectedNumber`). Free — Evolution names the receiving
   account on every event, so the first buyer message teaches us that number —
   but it only covers agencies that have connected WhatsApp, and it identifies
   the agency rather than a person, so the agent acts as that agency's owner.

An unrecognised number is acknowledged and dropped: without a tenant there is no
way to scope what the agent may touch.

The turn then goes to the system agent, not the buyer agent, and the thread is
stable per operator (`operator:<phone>`), so the assistant remembers the
conversation across days.

### The loop, and why the platform number is blacklisted

An operator who writes to us from the phone that owns their bot line creates a
cycle: our reply lands back on their own instance as an ordinary inbound message
— `fromMe` is false there, since it is a different account — so the buyer agent
would answer it, and we would answer that, forever.

The webhook therefore drops any event whose sender is the platform's own
`connectedNumber`, on any instance. Nothing the platform line says is ever a
buyer message.
