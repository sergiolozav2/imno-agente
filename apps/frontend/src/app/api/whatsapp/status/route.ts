import { NextRequest, NextResponse } from 'next/server'
import { getConnectionState, toClientState } from '@/lib/evolution'

/**
 * BFF route: report the WhatsApp connection state for an instance.
 * Maps Evolution's open/connecting/close to the client's
 * connected/connecting/disconnected values.
 */
export async function GET(request: NextRequest) {
  const instanceName = request.nextUrl.searchParams.get('instanceName')
  if (!instanceName) {
    return NextResponse.json({ message: 'instanceName is required' }, { status: 400 })
  }

  try {
    const state = await getConnectionState(instanceName)
    return NextResponse.json({ state: toClientState(state) })
  } catch {
    return NextResponse.json({ message: 'Failed to fetch status' }, { status: 502 })
  }
}
