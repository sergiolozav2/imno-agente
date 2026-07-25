/**
 * Pushes every variable the Worker needs from `.env.production` to Cloudflare,
 * one `wrangler secret put` per name, instead of typing nine prompts by hand.
 *
 *   node tools/deploy/cf-secrets.mjs [envFile]
 *
 * Values are piped in on stdin so they never appear in the process list. D1 and
 * R2 are not here: they reach the Worker as bindings from `wrangler.jsonc`.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { WORKER_VARS } from './targets.mjs'

const file = process.argv[2] ?? '.env.production'
const PLACEHOLDER_PREFIX = 'replace-with-'

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch {
  console.error(`✗ ${file} not found. Copy .env.production.sample to it first.`)
  process.exit(1)
}

const env = {}
for (const line of raw.split('\n')) {
  const trimmed = line.trim()
  if (trimmed === '' || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  env[trimmed.slice(0, eq).trim()] = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

const unusable = WORKER_VARS.filter(
  (name) => !env[name] || env[name].startsWith(PLACEHOLDER_PREFIX),
)
if (unusable.length > 0) {
  console.error(`✗ ${file} is missing usable values for: ${unusable.join(', ')}`)
  process.exit(1)
}

console.log(`Pushing ${WORKER_VARS.length} secrets to the imno-api Worker (production)\n`)
for (const name of WORKER_VARS) {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@imno/api', 'exec', 'wrangler', 'secret', 'put', name, '--env', 'production'],
    { input: env[name], stdio: ['pipe', 'pipe', 'inherit'] },
  )
  if (result.status !== 0) {
    console.error(`\n✗ failed on ${name}`)
    process.exit(result.status ?? 1)
  }
  console.log(`  ✓ ${name}`)
}

console.log('\n✓ Worker secrets updated. Redeploy with `pnpm deploy:api`.')
