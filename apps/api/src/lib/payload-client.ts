import { getPayload, type Payload } from 'payload'
import config from '../payload.config'

let cached: Promise<Payload> | null = null

/** Get a cached local Payload instance (admin, hooks, and access all active). */
export function getPayloadClient(): Promise<Payload> {
  if (!cached) {
    cached = getPayload({ config })
  }
  return cached
}
