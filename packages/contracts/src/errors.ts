/**
 * Non-disclosing, safe error codes shared by every boundary. Codes never carry
 * secret values or foreign-tenant metadata.
 */
export const ErrorCode = {
  AuthRequired: 'AUTH_REQUIRED',
  TenantForbidden: 'TENANT_FORBIDDEN',
  ResourceNotFound: 'RESOURCE_NOT_FOUND',
  CrossTenantReference: 'CROSS_TENANT_REFERENCE',
  InvalidPhone: 'INVALID_PHONE',
  InternalAuthInvalid: 'INTERNAL_AUTH_INVALID',
  ConfigInvalid: 'CONFIG_INVALID',
  ValidationFailed: 'VALIDATION_FAILED',
  ModelFailure: 'MODEL_FAILURE',
  ChannelFailure: 'CHANNEL_FAILURE',
  RenderFailure: 'RENDER_FAILURE',
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface SafeError {
  code: ErrorCode
  /** Human-safe message. Never contains secrets, prompts, or foreign metadata. */
  message?: string
}

/** Emitted by runtime-config when a required variable is missing/placeholder. */
export interface ConfigInvalidError {
  code: typeof ErrorCode.ConfigInvalid
  /** The offending variable NAME only — never its value. */
  variable: string
}

export interface HttpErrorShape {
  status: number
  code: ErrorCode
}

export const httpForError: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  TENANT_FORBIDDEN: 403,
  RESOURCE_NOT_FOUND: 404,
  CROSS_TENANT_REFERENCE: 422,
  INVALID_PHONE: 422,
  INTERNAL_AUTH_INVALID: 401,
  CONFIG_INVALID: 500,
  VALIDATION_FAILED: 422,
  MODEL_FAILURE: 502,
  CHANNEL_FAILURE: 502,
  RENDER_FAILURE: 500,
}
