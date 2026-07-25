/**
 * Pre-deploy checks that cost seconds instead of a CI round trip.
 *
 *   node tools/deploy/verify.mjs env .env              # local stack complete?
 *   node tools/deploy/verify.mjs env .env.production   # deploy inputs complete?
 *   node tools/deploy/verify.mjs health .env.production
 *
 * `env` only reads the file; it never contacts a provider. `health` hits the
 * public endpoint of every deployed service and reports the status line.
 */
import { readFileSync } from 'node:fs'
import {
  AGENT_VARS,
  FRONTEND_VARS,
  HEALTH_CHECKS,
  LOCAL_VARS,
  MUST_MATCH,
  PRODUCTION_VARS,
  WORKER_VARS,
} from './targets.mjs'

const PLACEHOLDER_PREFIX = 'replace-with-'
const FORBIDDEN_PUBLIC = [
  'NEXT_PUBLIC_PAYLOAD_SECRET',
  'NEXT_PUBLIC_INTERNAL_SERVICE_SECRET',
  'NEXT_PUBLIC_EVOLUTION_API_KEY',
  'NEXT_PUBLIC_EVOLUTION_WEBHOOK_SECRET',
  'NEXT_PUBLIC_LLM_API_KEY',
]

const [mode, file = '.env'] = process.argv.slice(2)

function parseEnvFile(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    fail(`${path} not found. Copy the matching sample file first.`)
  }
  const values = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    values[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
  return values
}

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function checkVars(env, names, label) {
  const missing = []
  const placeholder = []
  for (const name of names) {
    const value = env[name]
    if (value === undefined || value === '') missing.push(name)
    else if (value.startsWith(PLACEHOLDER_PREFIX)) placeholder.push(name)
  }
  if (missing.length === 0 && placeholder.length === 0) {
    console.log(`  ✓ ${label} (${names.length} vars)`)
    return true
  }
  if (missing.length > 0) console.log(`  ✗ ${label} missing: ${missing.join(', ')}`)
  if (placeholder.length > 0)
    console.log(`  ✗ ${label} still placeholder: ${placeholder.join(', ')}`)
  return false
}

function verifyEnv(path) {
  const env = parseEnvFile(path)
  const production = path.includes('production')
  console.log(`Checking ${path}\n`)

  let ok = checkVars(env, production ? PRODUCTION_VARS : LOCAL_VARS, 'file completeness')
  ok = checkVars(env, WORKER_VARS, 'apps/api (Cloudflare Worker)') && ok
  ok = checkVars(env, FRONTEND_VARS, 'apps/frontend (Render)') && ok
  ok = checkVars(env, AGENT_VARS, 'apps/agent (Render)') && ok

  const leaked = FORBIDDEN_PUBLIC.filter((key) => env[key] !== undefined)
  if (leaked.length > 0) {
    console.log(`  ✗ server-only secret exposed to the browser: ${leaked.join(', ')}`)
    ok = false
  }

  const expectedCfEnv = production ? 'production' : 'local'
  if (env.CLOUDFLARE_ENV !== expectedCfEnv) {
    console.log(`  ✗ CLOUDFLARE_ENV should be "${expectedCfEnv}", found "${env.CLOUDFLARE_ENV}"`)
    ok = false
  }

  if (production) {
    for (const name of MUST_MATCH) {
      console.log(`  · ${name} must hold this same value on Render`)
    }
    if (env.EVOLUTION_WEBHOOK_URL && env.API_URL) {
      const expected = `${env.API_URL.replace(/\/$/, '')}/api/webhooks/evolution`
      if (env.EVOLUTION_WEBHOOK_URL !== expected) {
        console.log(`  ✗ EVOLUTION_WEBHOOK_URL should be ${expected}`)
        ok = false
      }
    }
  }

  console.log(ok ? '\n✓ environment looks deployable' : '\n✗ fix the entries above')
  process.exit(ok ? 0 : 1)
}

async function verifyHealth(path) {
  const env = parseEnvFile(path)
  console.log(`Health checks from ${path}\n`)
  let ok = true

  for (const check of HEALTH_CHECKS) {
    const origin = env[check.origin]
    if (!origin) {
      console.log(`  · ${check.name}: ${check.origin} not set, skipped`)
      continue
    }
    const url = `${origin.replace(/\/$/, '')}${check.path}`
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const body = (await response.text()).slice(0, 120).replace(/\s+/g, ' ')
      const good = response.ok
      ok = ok && good
      console.log(`  ${good ? '✓' : '✗'} ${check.name} ${response.status} ${url}`)
      if (!good) console.log(`      ${body}`)
    } catch (error) {
      ok = false
      console.log(`  ✗ ${check.name} unreachable ${url}`)
      console.log(`      ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log(ok ? '\n✓ every service answered' : '\n✗ some services are down')
  process.exit(ok ? 0 : 1)
}

if (mode === 'env') verifyEnv(file)
else if (mode === 'health') await verifyHealth(file)
else fail('usage: node tools/deploy/verify.mjs <env|health> [envFile]')
