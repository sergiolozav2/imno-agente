export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ status: 'ok', service: 'api', timestamp: new Date().toISOString() })
}
