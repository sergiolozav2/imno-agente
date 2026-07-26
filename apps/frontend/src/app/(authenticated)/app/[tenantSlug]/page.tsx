import { redirect } from 'next/navigation'

export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  // The assistant is the workspace's front door.
  redirect(`/app/${tenantSlug}/chat`)
}
