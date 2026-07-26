import { afterEach, describe, expect, it } from 'vitest'
import { absoluteMediaUrl } from './data-operations'

/**
 * Media URLs leaving the internal bridge have to be absolute: the agent
 * container downloads property photos from them and WhatsApp fetches the
 * rendered reel. The deployed Worker has no `API_URL`, which is what left them
 * relative and unfetchable, so the request-origin fallback is the load-bearing
 * case here.
 */

const original = process.env.API_URL

afterEach(() => {
  if (original === undefined) delete process.env.API_URL
  else process.env.API_URL = original
})

describe('absoluteMediaUrl', () => {
  it('falls back to the calling request origin when API_URL is unset', () => {
    delete process.env.API_URL
    expect(absoluteMediaUrl({ origin: 'https://imno-api.workers.dev' }, '/api/media/x.jpg')).toBe(
      'https://imno-api.workers.dev/api/media/x.jpg',
    )
  })

  it('prefers the configured API_URL over the request origin', () => {
    process.env.API_URL = 'https://api.imno.test'
    expect(absoluteMediaUrl({ origin: 'https://imno-api.workers.dev' }, '/api/media/x.jpg')).toBe(
      'https://api.imno.test/api/media/x.jpg',
    )
  })

  it('trims a trailing slash on the base', () => {
    process.env.API_URL = 'https://api.imno.test/'
    expect(absoluteMediaUrl({}, '/api/media/x.jpg')).toBe('https://api.imno.test/api/media/x.jpg')
  })

  it('leaves an already absolute URL alone', () => {
    delete process.env.API_URL
    expect(absoluteMediaUrl({ origin: 'https://other.test' }, 'https://cdn.test/x.jpg')).toBe(
      'https://cdn.test/x.jpg',
    )
  })
})
