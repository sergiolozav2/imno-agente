/**
 * Seeds the local database with a realistic multi-tenant dataset for manual
 * testing: two agencies, their owners/members, listings, leads, WhatsApp
 * conversations and the Evolution instance rows the WhatsApp flow expects.
 *
 * Idempotent — every record is looked up by its natural key first, so re-running
 * tops up missing rows instead of duplicating. Use `pnpm db:reset` to wipe.
 *
 * Run with: `pnpm db:seed`
 */
import type { CollectionSlug, Payload, RequiredDataFromCollectionSlug, Where } from 'payload'
import sharp from 'sharp'
import { runScript, withLocalPayload } from './local-payload'

const INSTANCE_PREFIX = process.env.EVOLUTION_INSTANCE_PREFIX || 'imno-agent'

/** Shared password for every seeded user, printed at the end of the run. */
const SEED_PASSWORD = 'SeedPassw0rd!'

interface UploadFile {
  data: Buffer
  mimetype: string
  name: string
  size: number
}

const created: Record<string, number> = {}
const reused: Record<string, number> = {}

function track(bucket: Record<string, number>, collection: string): void {
  bucket[collection] = (bucket[collection] ?? 0) + 1
}

/**
 * Create a document unless one already matches `where`, returning its id either
 * way. `overrideAccess` plus the absence of `req.user` is the trusted seed path:
 * tenant access rules and the owner-membership hook both step aside for it.
 */
async function upsert<S extends CollectionSlug>(
  payload: Payload,
  collection: S,
  where: Where,
  data: RequiredDataFromCollectionSlug<S>,
  file?: UploadFile,
): Promise<number> {
  const existing = await payload.find({
    collection,
    where,
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    track(reused, collection)
    return existing.docs[0].id as number
  }

  const doc = await payload.create({ collection, data, file, overrideAccess: true })
  track(created, collection)
  return doc.id as number
}

/** Solid-colour JPEG so seeded listings have real, viewable images in R2. */
async function solidImage(name: string, rgb: [number, number, number]): Promise<UploadFile> {
  const data = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: { r: rgb[0], g: rgb[1], b: rgb[2] },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer()
  return { data, mimetype: 'image/jpeg', name, size: data.length }
}

// --- Fixture data -----------------------------------------------------------

const TENANTS = [
  {
    slug: 'demo-agency',
    name: 'Demo Agency',
    countryCode: 'ES',
    publicChatKey: 'pk-demo-agency-local',
    allowedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    connectionState: 'open' as const,
    webhookConfigured: true,
  },
  {
    slug: 'costa-homes',
    name: 'Costa Homes',
    countryCode: 'ES',
    publicChatKey: 'pk-costa-homes-local',
    allowedOrigins: ['http://localhost:3000'],
    connectionState: 'close' as const,
    webhookConfigured: false,
  },
]

const USERS = [
  { email: 'owner@demo.test', displayName: 'Demo Owner', tenant: 'demo-agency', role: 'owner' },
  { email: 'agent@demo.test', displayName: 'Demo Agent', tenant: 'demo-agency', role: 'member' },
  { email: 'owner@costa.test', displayName: 'Costa Owner', tenant: 'costa-homes', role: 'owner' },
] as const

const ZONAL_PRICES = [
  { tenant: 'demo-agency', zone: 'Centro', pricingUnit: 'per_sqm' as const, amount: 4200 },
  { tenant: 'demo-agency', zone: 'Centro', pricingUnit: 'per_month' as const, amount: 1450 },
  { tenant: 'demo-agency', zone: 'Playa', pricingUnit: 'per_sqm' as const, amount: 5100 },
  { tenant: 'costa-homes', zone: 'Marina', pricingUnit: 'per_sqm' as const, amount: 3800 },
]

const PROPERTIES = [
  {
    tenant: 'demo-agency',
    reference: 'DEM-001',
    title: 'Ático reformado con terraza en Centro',
    description: 'Ático de 3 dormitorios totalmente reformado, terraza de 20 m² y vistas abiertas.',
    price: 435000,
    zone: 'Centro',
    pricingUnit: 'total' as const,
    status: 'available' as const,
    bedrooms: 3,
    bathrooms: 2,
    areaSqm: 118,
    imageColor: [198, 152, 108] as [number, number, number],
  },
  {
    tenant: 'demo-agency',
    reference: 'DEM-002',
    title: 'Piso a pie de playa con 2 dormitorios',
    description: 'Primera línea de playa, reformado en 2024, plaza de garaje incluida.',
    price: 289000,
    zone: 'Playa',
    pricingUnit: 'total' as const,
    status: 'reserved' as const,
    bedrooms: 2,
    bathrooms: 1,
    areaSqm: 76,
    imageColor: [104, 154, 186] as [number, number, number],
  },
  {
    tenant: 'demo-agency',
    reference: 'DEM-003',
    title: 'Alquiler de estudio céntrico',
    description: 'Estudio amueblado ideal para estancias largas, gastos de comunidad incluidos.',
    price: 1100,
    zone: 'Centro',
    pricingUnit: 'per_month' as const,
    status: 'available' as const,
    bedrooms: 1,
    bathrooms: 1,
    areaSqm: 42,
    imageColor: [148, 148, 156] as [number, number, number],
  },
  {
    tenant: 'demo-agency',
    reference: 'DEM-004',
    title: 'Villa con piscina y jardín',
    description: 'Villa independiente de 4 dormitorios, piscina privada y parcela de 600 m².',
    price: 815000,
    zone: 'Playa',
    pricingUnit: 'total' as const,
    status: 'sold' as const,
    bedrooms: 4,
    bathrooms: 3,
    areaSqm: 240,
    imageColor: [126, 168, 122] as [number, number, number],
  },
  {
    tenant: 'costa-homes',
    reference: 'CST-001',
    title: 'Apartamento frente al puerto deportivo',
    description: 'Vistas al puerto, dos terrazas y acceso directo al paseo marítimo.',
    price: 362000,
    zone: 'Marina',
    pricingUnit: 'total' as const,
    status: 'available' as const,
    bedrooms: 2,
    bathrooms: 2,
    areaSqm: 92,
    imageColor: [172, 124, 148] as [number, number, number],
  },
]

const CLIENTS = [
  {
    tenant: 'demo-agency',
    name: 'Lucía Fernández',
    normalizedPhone: '+34600111222',
    email: 'lucia.fernandez@example.test',
    leadStatus: 'Hot' as const,
  },
  {
    tenant: 'demo-agency',
    name: 'Marc Puig',
    normalizedPhone: '+34600333444',
    email: 'marc.puig@example.test',
    leadStatus: 'Warm' as const,
  },
  {
    tenant: 'demo-agency',
    name: 'Sofía Márquez',
    normalizedPhone: '+34600555666',
    email: null,
    leadStatus: 'Cold' as const,
  },
  {
    tenant: 'costa-homes',
    name: 'Tomás Ruiz',
    normalizedPhone: '+34611777888',
    email: 'tomas.ruiz@example.test',
    leadStatus: 'Warm' as const,
  },
]

type SeedMessage = {
  direction: 'inbound' | 'outbound'
  author: 'buyer' | 'ai' | 'human' | 'system'
  text: string
}

const CONVERSATIONS: {
  tenant: string
  clientPhone: string
  channel: 'whatsapp' | 'web-chat'
  channelThreadId: string
  botPaused: boolean
  messages: SeedMessage[]
}[] = [
  {
    tenant: 'demo-agency',
    clientPhone: '+34600111222',
    channel: 'whatsapp',
    channelThreadId: '34600111222@s.whatsapp.net',
    botPaused: false,
    messages: [
      {
        direction: 'inbound',
        author: 'buyer',
        text: 'Hola, ¿el ático de Centro sigue disponible?',
      },
      {
        direction: 'outbound',
        author: 'ai',
        text: 'Hola Lucía. Sí, el ático DEM-001 está disponible por 435.000 €. ¿Quieres ver fotos?',
      },
      { direction: 'inbound', author: 'buyer', text: 'Sí, y me gustaría visitarlo el sábado.' },
      {
        direction: 'outbound',
        author: 'human',
        text: 'Te confirmo la visita para el sábado a las 11:00.',
      },
    ],
  },
  {
    tenant: 'demo-agency',
    clientPhone: '+34600333444',
    channel: 'web-chat',
    channelThreadId: 'web-demo-agency-marc-puig',
    botPaused: true,
    messages: [
      { direction: 'inbound', author: 'buyer', text: '¿Cuánto cuesta el m² en la zona de Playa?' },
      {
        direction: 'outbound',
        author: 'ai',
        text: 'En Playa el precio de referencia es de 5.100 €/m².',
      },
      { direction: 'inbound', author: 'buyer', text: 'Prefiero hablar con un agente.' },
      {
        direction: 'outbound',
        author: 'system',
        text: 'Conversación derivada a un agente humano.',
      },
    ],
  },
  {
    tenant: 'costa-homes',
    clientPhone: '+34611777888',
    channel: 'whatsapp',
    channelThreadId: '34611777888@s.whatsapp.net',
    botPaused: false,
    messages: [
      {
        direction: 'inbound',
        author: 'buyer',
        text: 'Busco algo cerca del puerto, hasta 400.000 €.',
      },
      {
        direction: 'outbound',
        author: 'ai',
        text: 'Tengo el CST-001 frente al puerto por 362.000 €. ¿Te lo envío?',
      },
    ],
  },
]

// --- Seed run ---------------------------------------------------------------

runScript('Seed', async () => {
  await withLocalPayload(async (payload) => {
    const tenantIds = new Map<string, number>()
    const clientIds = new Map<string, number>()
    const instanceIds = new Map<string, number>()

    console.log('→ Tenants and WhatsApp instances')
    for (const tenant of TENANTS) {
      const tenantId = await upsert(
        payload,
        'tenants',
        { slug: { equals: tenant.slug } },
        {
          slug: tenant.slug,
          name: tenant.name,
          countryCode: tenant.countryCode,
          publicChatKey: tenant.publicChatKey,
          allowedOrigins: tenant.allowedOrigins,
        },
      )
      tenantIds.set(tenant.slug, tenantId)

      const instanceName = `${INSTANCE_PREFIX}-${tenant.slug}`
      instanceIds.set(
        tenant.slug,
        await upsert(
          payload,
          'whatsapp-instances',
          { instanceName: { equals: instanceName } },
          {
            tenant: tenantId,
            instanceName,
            connectionState: tenant.connectionState,
            webhookConfigured: tenant.webhookConfigured,
          },
        ),
      )
    }

    console.log('→ Users and memberships')
    for (const user of USERS) {
      const userId = await upsert(
        payload,
        'users',
        { email: { equals: user.email } },
        { email: user.email, password: SEED_PASSWORD, displayName: user.displayName },
      )
      const tenantId = tenantIds.get(user.tenant)!
      await upsert(
        payload,
        'memberships',
        { and: [{ user: { equals: userId } }, { tenant: { equals: tenantId } }] },
        { user: userId, tenant: tenantId, role: user.role },
      )
    }

    console.log('→ Zonal prices')
    for (const price of ZONAL_PRICES) {
      const tenantId = tenantIds.get(price.tenant)!
      await upsert(
        payload,
        'zonal-prices',
        {
          and: [
            { tenant: { equals: tenantId } },
            { zone: { equals: price.zone } },
            { pricingUnit: { equals: price.pricingUnit } },
          ],
        },
        {
          tenant: tenantId,
          zone: price.zone,
          pricingUnit: price.pricingUnit,
          amount: price.amount,
          currency: 'EUR',
        },
      )
    }

    console.log('→ Properties and media assets')
    for (const property of PROPERTIES) {
      const tenantId = tenantIds.get(property.tenant)!
      const filename = `${property.reference.toLowerCase()}-cover.jpg`

      // Media lives in R2; if the local bucket is unavailable the listing is
      // still worth seeding, so an upload failure only costs us the image.
      let mediaId: number | null = null
      try {
        mediaId = await upsert(
          payload,
          'media-assets',
          { filename: { equals: filename } },
          { tenant: tenantId, kind: 'image' },
          await solidImage(filename, property.imageColor),
        )
      } catch (err) {
        console.warn(
          `  ! skipped image for ${property.reference}:`,
          err instanceof Error ? err.message : err,
        )
      }

      await upsert(
        payload,
        'properties',
        {
          and: [{ tenant: { equals: tenantId } }, { reference: { equals: property.reference } }],
        },
        {
          tenant: tenantId,
          reference: property.reference,
          title: property.title,
          description: property.description,
          price: property.price,
          currency: 'EUR',
          zone: property.zone,
          pricingUnit: property.pricingUnit,
          status: property.status,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          areaSqm: property.areaSqm,
          ...(mediaId ? { images: [mediaId], mainImage: mediaId } : {}),
        },
      )
    }

    console.log('→ Buyer clients')
    for (const client of CLIENTS) {
      const tenantId = tenantIds.get(client.tenant)!
      clientIds.set(
        `${client.tenant}:${client.normalizedPhone}`,
        await upsert(
          payload,
          'buyer-clients',
          {
            and: [
              { tenant: { equals: tenantId } },
              { normalizedPhone: { equals: client.normalizedPhone } },
            ],
          },
          {
            tenant: tenantId,
            name: client.name,
            normalizedPhone: client.normalizedPhone,
            email: client.email,
            leadStatus: client.leadStatus,
          },
        ),
      )
    }

    console.log('→ Conversations, messages and processing rows')
    for (const conversation of CONVERSATIONS) {
      const tenantId = tenantIds.get(conversation.tenant)!
      const clientId = clientIds.get(`${conversation.tenant}:${conversation.clientPhone}`)!

      const conversationId = await upsert(
        payload,
        'conversations',
        {
          and: [
            { tenant: { equals: tenantId } },
            { channel: { equals: conversation.channel } },
            { channelThreadId: { equals: conversation.channelThreadId } },
          ],
        },
        {
          tenant: tenantId,
          client: clientId,
          channel: conversation.channel,
          channelThreadId: conversation.channelThreadId,
          botPaused: conversation.botPaused,
        },
      )

      for (const [index, message] of conversation.messages.entries()) {
        const idempotencyKey = `seed:${conversation.channelThreadId}:${index}`
        const isInbound = message.direction === 'inbound'
        const messageId = await upsert(
          payload,
          'messages',
          { idempotencyKey: { equals: idempotencyKey } },
          {
            tenant: tenantId,
            conversation: conversationId,
            direction: message.direction,
            author: message.author,
            text: message.text,
            idempotencyKey,
            providerMessageId:
              conversation.channel === 'whatsapp' ? `seed-msg-${idempotencyKey}` : null,
            processingState: 'completed',
            deliveryState: isInbound ? 'unknown' : 'sent',
          },
        )

        if (isInbound) {
          await upsert(
            payload,
            'message-processing',
            { inboundMessage: { equals: messageId } },
            { tenant: tenantId, inboundMessage: messageId, state: 'completed', attempts: 1 },
          )
        }
      }

      if (conversation.channel === 'whatsapp') {
        const instanceId = instanceIds.get(conversation.tenant)!
        const providerEventKey = `seed:${conversation.channelThreadId}:messages-upsert`
        await upsert(
          payload,
          'webhook-receipts',
          {
            and: [
              { instance: { equals: instanceId } },
              { providerEventKey: { equals: providerEventKey } },
            ],
          },
          {
            tenant: tenantId,
            instance: instanceId,
            providerEventKey,
            acceptedEventType: 'MESSAGES_UPSERT',
            receivedAt: new Date().toISOString(),
          },
        )
      }
    }

    const collections = [...new Set([...Object.keys(created), ...Object.keys(reused)])].sort()
    console.log('\nCollection            created  existing')
    for (const collection of collections) {
      console.log(
        `${collection.padEnd(20)}  ${String(created[collection] ?? 0).padStart(7)}  ${String(
          reused[collection] ?? 0,
        ).padStart(8)}`,
      )
    }

    console.log(`\nLogins (password: ${SEED_PASSWORD}):`)
    for (const user of USERS) {
      console.log(`  ${user.email.padEnd(18)} ${user.role.padEnd(6)} of ${user.tenant}`)
    }
    console.log('\nAdmin UI: http://localhost:3001/admin')
  })

  console.log('\nSeed complete.')
})
