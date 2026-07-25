export const LEAD_STATUSES = ['Cold', 'Warm', 'Hot'] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export interface BuyerClient {
  /** Payload IDs are numeric on the D1/SQLite adapter, strings elsewhere. */
  id: string | number
  name: string
  email?: string | null
  normalizedPhone?: string | null
  leadStatus: LeadStatus
  createdAt: string
}

export const LEAD_LABELS: Record<LeadStatus, string> = {
  Cold: 'Frío',
  Warm: 'Templado',
  Hot: 'Caliente',
}

/** Badge class matching the lead temperature. */
export function leadBadge(status: LeadStatus): string {
  return status === 'Hot' ? 'badge-error' : status === 'Warm' ? 'badge-warning' : 'badge-info'
}
