import { bindingsReady } from '../../../cloudflare'

export const dynamic = 'force-dynamic'

export function GET() {
  const ready = bindingsReady()
  return Response.json(
    {
      status: ready ? 'ok' : 'error',
      service: 'api',
      bindings: ready ? 'ready' : 'uninitialized',
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
