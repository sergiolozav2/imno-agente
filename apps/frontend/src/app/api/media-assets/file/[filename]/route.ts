import { NextRequest, NextResponse } from 'next/server'
import { authFetch } from '@/lib/auth'

/**
 * BFF route: Proxy media asset files from the Payload API.
 *
 * Payload returns media URLs relative to its own origin (e.g.
 * `/api/media-assets/file/palm-front.jpg`). Rendered in the browser those
 * resolve against the frontend origin (port 3000) and 404, and the API's
 * read access is tenant-scoped so the browser can't hit it directly.
 * This route forwards the request to the API with the session cookie and
 * streams the file back through the same origin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params

  const response = await authFetch(`/api/media-assets/file/${encodeURIComponent(filename)}`)

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { message: 'Media asset not found' },
      { status: response.status || 404 },
    )
  }

  const headers = new Headers()
  const contentType = response.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)
  const contentLength = response.headers.get('content-length')
  if (contentLength) headers.set('content-length', contentLength)
  const cacheControl = response.headers.get('cache-control')
  headers.set('cache-control', cacheControl || 'private, max-age=3600')

  return new NextResponse(response.body, {
    status: 200,
    headers,
  })
}
