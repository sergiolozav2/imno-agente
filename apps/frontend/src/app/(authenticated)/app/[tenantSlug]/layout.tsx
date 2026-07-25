import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AppShell } from './app-shell'

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const membership = session.memberships.find((m) => m.tenantSlug === tenantSlug)
  if (!membership) {
    // User doesn't have access to this tenant
    redirect('/login')
  }

  return (
    <AppShell tenantSlug={tenantSlug} tenantName={membership.tenantName} user={session.user}>
      {children}
    </AppShell>
  )
}
