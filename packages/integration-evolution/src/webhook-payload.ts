/**
 * Translation from Evolution's wire format into the provider-neutral ingress
 * DTO (`evolutionWebhookInputSchema`).
 *
 * Evolution v2 posts a nested envelope:
 *
 *   { event, instance, date_time, data: { key, message, messageTimestamp } }
 *
 * Two fields are easy to get wrong and both are security-relevant:
 * the buyer is `data.key.remoteJid` (the envelope's own top-level `sender` is
 * the *connected account*, i.e. us — surfaced separately as `connectedAccount`,
 * which is how we learn a tenant line's own number), and `data.key.fromMe` is
 * what marks an outbound echo that must not be answered.
 */

/** Pull the human-readable text out of Evolution's polymorphic message object. */
export function extractMessageText(
  message: Record<string, unknown> | undefined,
): string | undefined {
  if (!message) return undefined
  if (typeof message.conversation === 'string') return message.conversation

  const extended = message.extendedTextMessage as { text?: unknown } | undefined
  if (extended && typeof extended.text === 'string') return extended.text

  const image = message.imageMessage as { caption?: unknown } | undefined
  if (image && typeof image.caption === 'string') return image.caption

  const video = message.videoMessage as { caption?: unknown } | undefined
  if (video && typeof video.caption === 'string') return video.caption

  return undefined
}

/**
 * Map a raw Evolution webhook body onto the flat ingress DTO. Bodies that are
 * already flat (replay tooling and tests) pass through untouched, so both
 * shapes can feed the same validator.
 */
export function normalizeEvolutionWebhookPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const body = raw as Record<string, unknown>

  if (typeof body.instanceName === 'string' && typeof body.eventType === 'string') {
    return body
  }

  const data = (body.data ?? {}) as Record<string, unknown>
  const key = (data.key ?? {}) as Record<string, unknown>
  const message = data.message as Record<string, unknown> | undefined

  // Evolution sends seconds; the DTO carries an ISO instant.
  const messageTimestamp =
    typeof data.messageTimestamp === 'number'
      ? new Date(data.messageTimestamp * 1000).toISOString()
      : undefined

  return {
    instanceName: body.instance ?? body.instanceName,
    eventType: body.event ?? body.eventType,
    eventId: typeof key.id === 'string' ? key.id : undefined,
    messageId: typeof key.id === 'string' ? key.id : undefined,
    sender: (key.remoteJid as string | undefined) ?? (body.sender as string | undefined),
    connectedAccount: body.sender as string | undefined,
    fromConnectedAccount: key.fromMe === true,
    occurredAt: (body.date_time as string | undefined) ?? messageTimestamp,
    text: extractMessageText(message),
  }
}
