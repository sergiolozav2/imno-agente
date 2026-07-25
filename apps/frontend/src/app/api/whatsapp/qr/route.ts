import { NextRequest, NextResponse } from 'next/server'
import { createInstance, getQrCode } from '@/lib/evolution'

/**
 * BFF route: fetch the current WhatsApp QR code for an instance from Evolution.
 * Returns `{ qr }` as a data URL the client can render directly in an <img>.
 *
 * Self-healing: if no QR is available (e.g. the instance was never provisioned
 * on Evolution), it creates the instance and retries once.
 */
export async function GET(request: NextRequest) {
  const instanceName = request.nextUrl.searchParams.get('instanceName')
  if (!instanceName) {
    return NextResponse.json({ message: 'instanceName is required' }, { status: 400 })
  }

  try {
    let qr = await getQrCode(instanceName)
    if (!qr) {
      // Instance may not exist yet on Evolution — provision then retry.
      await createInstance(instanceName)
      qr = await getQrCode(instanceName)
    }
    if (!qr) {
      return NextResponse.json({ message: 'QR not available yet' }, { status: 404 })
    }
    return NextResponse.json({ qr })
  } catch {
    return NextResponse.json({ message: 'Failed to fetch QR code' }, { status: 502 })
  }
}
