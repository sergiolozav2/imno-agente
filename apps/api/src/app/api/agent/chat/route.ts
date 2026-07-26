/**
 * One operator turn with the system agent from the app UI.
 *
 * Same agent, tools, and memory resource the platform WhatsApp line uses — this
 * is just a second transport. Omitting `threadId` starts a new session; passing
 * one continues it.
 */
import { requestSystemChat } from '@/lib/agent-client'
import { loadAgentRuntimeConfig, resolveOperatorSession } from '@/lib/operator-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return Response.json({ message: 'Invalid body' }, { status: 400 })

  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug : null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length === 0) {
    return Response.json({ message: 'message is required' }, { status: 400 })
  }

  const resolved = await resolveOperatorSession(tenantSlug)
  if (!resolved.ok) {
    return Response.json({ message: 'Not authorized' }, { status: resolved.status })
  }

  const config = loadAgentRuntimeConfig()
  if (!config) {
    return Response.json({ message: 'Agent runtime is not configured' }, { status: 503 })
  }

  const threadId = typeof body.threadId === 'string' && body.threadId ? body.threadId : undefined

  const reply = await requestSystemChat(config, {
    tenantId: resolved.session.tenantId,
    tenantSlug: resolved.session.tenantSlug,
    userId: resolved.session.userId,
    message,
    ...(threadId ? { threadId } : {}),
  })

  if (!reply.ok) {
    return Response.json(
      { message: reply.error.message ?? 'The assistant failed' },
      { status: 502 },
    )
  }

  return Response.json({
    text: reply.value.text,
    threadId: reply.value.threadId ?? threadId ?? null,
    toolCalls: reply.value.toolCalls ?? [],
  })
}
