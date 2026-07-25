import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Imno API',
  description: 'Imno API — scaffold',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
