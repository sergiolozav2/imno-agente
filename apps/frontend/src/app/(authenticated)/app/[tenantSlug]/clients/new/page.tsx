import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant } from '@/lib/auth'
import { IconArrowLeft } from '@/components/icons'
import { ClientForm } from '../client-form'

export default async function NewClientPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const tenant = await resolveTenant(tenantSlug)

  if (!tenant) {
    redirect('/login')
  }

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <Link href={`/app/${tenantSlug}/clients`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver a clientes
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Nuevo cliente</h1>
          <p className="page-subtitle">Añade un nuevo contacto o lead</p>
        </div>
      </div>

      <div className="card">
        <ClientForm tenantSlug={tenantSlug} tenantId={tenant.tenantId} />
      </div>
    </div>
  )
}
