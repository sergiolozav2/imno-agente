import { redirect } from 'next/navigation'

export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  // Redirect to properties by default
  redirect(`/app/${tenantSlug}/properties`)
}
