import { type Result, type SafeError, ErrorCode, err, ok } from '@imno/contracts'

export interface PropertyMediaInput {
  /** Ordered image asset ids selected for the property. */
  imageIds: string[]
  /** Chosen main image id, or null when there are no images. */
  mainImageId: string | null
  /** Image asset ids known to belong to the active tenant. */
  tenantOwnedImageIds: string[]
  /** Optional 3D model asset id. */
  model3dId?: string | null
  /** 3D model asset ids known to belong to the active tenant. */
  tenantOwnedModelIds?: string[]
}

/**
 * Enforce the property media invariants server-side:
 *  - images empty  <=>  mainImageId absent
 *  - when images exist, mainImageId references exactly one member of the set
 *  - no duplicate image ids
 *  - every image belongs to the active tenant (reject foreign media)
 *  - optional 3D asset belongs to the active tenant
 */
export function validatePropertyMedia(input: PropertyMediaInput): Result<void, SafeError> {
  const { imageIds, mainImageId } = input
  const owned = new Set(input.tenantOwnedImageIds)

  const unique = new Set(imageIds)
  if (unique.size !== imageIds.length) {
    return err({ code: ErrorCode.ValidationFailed, message: 'Duplicate image ids.' })
  }

  for (const id of imageIds) {
    if (!owned.has(id)) {
      return err({ code: ErrorCode.CrossTenantReference })
    }
  }

  if (imageIds.length === 0) {
    if (mainImageId) {
      return err({
        code: ErrorCode.ValidationFailed,
        message: 'A property with no images cannot have a main image.',
      })
    }
  } else {
    if (!mainImageId) {
      return err({
        code: ErrorCode.ValidationFailed,
        message: 'A property with images requires exactly one main image.',
      })
    }
    if (!unique.has(mainImageId)) {
      return err({
        code: ErrorCode.ValidationFailed,
        message: 'Main image must be one of the property images.',
      })
    }
  }

  if (input.model3dId) {
    const ownedModels = new Set(input.tenantOwnedModelIds ?? [])
    if (!ownedModels.has(input.model3dId)) {
      return err({ code: ErrorCode.CrossTenantReference })
    }
  }

  return ok(undefined)
}

/**
 * Deterministically choose a replacement main image after the current one is
 * removed. Picks the first remaining image (stable order); returns null when
 * no images remain (allowed only when the property has no images).
 */
export function chooseReplacementMainImage(remainingImageIds: string[]): string | null {
  return remainingImageIds[0] ?? null
}
