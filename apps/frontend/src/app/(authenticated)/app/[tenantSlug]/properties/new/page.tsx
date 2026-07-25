import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveTenant } from '@/lib/auth'
import { IconArrowLeft } from '@/components/icons'
import { NewProperty } from './new-property-client'

export default async function NewPropertyPage({
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
    <div className="container">
      <Link href={`/app/${tenantSlug}/properties`} className="breadcrumb">
        <IconArrowLeft width={16} height={16} /> Volver a propiedades
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Nueva propiedad</h1>
          <p className="page-subtitle">Crea un nuevo inmueble en tu catálogo</p>
        </div>
      </div>

      <NewProperty tenantSlug={tenantSlug} tenantId={tenant.tenantId} />
    </div>
  )
}
