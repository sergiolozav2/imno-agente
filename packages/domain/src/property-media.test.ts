import { describe, it, expect } from 'vitest'
import { validatePropertyMedia, chooseReplacementMainImage } from './property-media'

const owned = ['img-1', 'img-2', 'img-3']

describe('validatePropertyMedia', () => {
  it('accepts images with exactly one main image in the set', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1', 'img-2'],
      mainImageId: 'img-1',
      tenantOwnedImageIds: owned,
    })
    expect(r.ok).toBe(true)
  })

  it('requires a main image when images exist', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1'],
      mainImageId: null,
      tenantOwnedImageIds: owned,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('VALIDATION_FAILED')
  })

  it('allows no main image only when there are no images', () => {
    const r = validatePropertyMedia({ imageIds: [], mainImageId: null, tenantOwnedImageIds: owned })
    expect(r.ok).toBe(true)
  })

  it('rejects a main image not in the property image set', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1'],
      mainImageId: 'img-2',
      tenantOwnedImageIds: owned,
    })
    expect(r.ok).toBe(false)
  })

  it('rejects foreign media before persistence', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1', 'foreign-9'],
      mainImageId: 'img-1',
      tenantOwnedImageIds: owned,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CROSS_TENANT_REFERENCE')
  })

  it('rejects a foreign 3D model', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1'],
      mainImageId: 'img-1',
      tenantOwnedImageIds: owned,
      model3dId: 'foreign-model',
      tenantOwnedModelIds: ['model-1'],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('CROSS_TENANT_REFERENCE')
  })

  it('rejects duplicate image ids', () => {
    const r = validatePropertyMedia({
      imageIds: ['img-1', 'img-1'],
      mainImageId: 'img-1',
      tenantOwnedImageIds: owned,
    })
    expect(r.ok).toBe(false)
  })
})

describe('chooseReplacementMainImage', () => {
  it('deterministically picks the first remaining image', () => {
    expect(chooseReplacementMainImage(['img-2', 'img-3'])).toBe('img-2')
  })
  it('returns null when no images remain', () => {
    expect(chooseReplacementMainImage([])).toBeNull()
  })
})
