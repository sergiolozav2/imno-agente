/**
 * The operator's stored system-agent sessions, for the app UI's chat sidebar.
 *
 * Without `threadId` this lists sessions newest first; with one it replays that
 * session's messages. Both are scoped to the caller's own memory resource by the
 * agent runtime, so an id belonging to someone else reads as not found.
 */
import { requestSystemSession, requestSystemSessions } from '@/lib/agent-client'
import { loadAgentRuntimeConfig, resolveOperatorSession } from '@/lib/operator-session'

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const tenantSlug = url.searchParams.get('tenantSlug')
  const threadId = url.searchParams.get('threadId')

  const resolved = await resolveOperatorSession(tenantSlug)
  if (!resolved.ok) {
    return Response.json({ message: 'Not authorized' }, { status: resolved.status })
  }

  const config = loadAgentRuntimeConfig()
  if (!config) {
    return Response.json({ message: 'Agent runtime is not configured' }, { status: 503 })
  }

  const { tenantId, userId } = resolved.session

  if (threadId) {
    const session = await requestSystemSession(config, { tenantId, userId, threadId })
    if (!session.ok) {
      return Response.json({ message: 'Session not found' }, { status: 404 })
    }
    return Response.json(session.value)
  }

  const sessions = await requestSystemSessions(config, { tenantId, userId, limit: 40 })
  if (!sessions.ok) {
    return Response.json({ sessions: [] })
  }
  return Response.json(sessions.value)
}
