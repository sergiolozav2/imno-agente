import { redirect } from 'next/navigation'
import { getSession, resolveTenant } from '@/lib/auth'
import { AssistantChat } from './assistant-chat'

export default async function ChatPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)
  if (!tenant) {
    redirect('/login')
  }

  const session = await getSession()

  return <AssistantChat tenantSlug={tenantSlug} userName={session?.user.displayName ?? ''} />
}
