const BASE = 'https://c21.com.bo'

export type C21Listing = {
  id: string
  idOriginal: number
  encabezado: string
  precio: string | number
  moneda: string
  precios?: {
    vista?: { precio: number; moneda: string; precioFormat: string }
  }
  lat: number
  lon: number
  m2C: number | null
  m2T: number | null
  recamaras: number | null
  banos: number | null
  estacionamientos: number | null
  municipio: string
  municipioWeb: string
  colonia: string
  calle: string
  estado: string
  pais: string
  tipoOperacion: string
  tipoPropiedad: string
  urlCorrectaPropiedad: string
  fechaAlta: string
  fechaModificacion: string
  conMapa: boolean
  ocultarPrecioInternet: boolean
  [key: string]: unknown
}

export type C21SearchResponse = {
  totalHits: string | number
  totalHitsRelation?: string
  results: C21Listing[]
  resultsPath?: string
}

export type SearchParams = {
  /** e.g. departamento | casa */
  tipo: string
  /** venta | renta / alquiler — site uses operacion_venta */
  operacion: 'venta' | 'renta'
  pais?: string
  estado?: string
  page?: number
  order?: string
}

export function buildSearchUrl(params: SearchParams): string {
  const pais = params.pais ?? 'bolivia'
  const estado = params.estado ?? 'santa-cruz'
  const order = params.order ?? 'fecha-de-alta_descendiente'
  const page = params.page ?? 1

  let path =
    `/v/resultados/tipo_${params.tipo}` +
    `/operacion_${params.operacion}` +
    `/en-pais_${pais}` +
    `/en-estado_${estado}` +
    `/ordenado-por_${order}`

  if (page > 1) path += `/pagina_${page}`

  const url = new URL(path, BASE)
  url.searchParams.set('json', 'true')
  return url.toString()
}

export async function fetchSearchPage(params: SearchParams): Promise<C21SearchResponse> {
  const url = buildSearchUrl(params)
  const res = await fetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'user-agent': 'Mozilla/5.0 (compatible; imno-experiments/0.1)',
      referer: url.replace('?json=true', ''),
    },
  })

  if (!res.ok) {
    throw new Error(`C21 HTTP ${res.status} for ${url}: ${await res.text()}`)
  }

  return (await res.json()) as C21SearchResponse
}

/** Slim listing for heatmap / analysis experiments. */
export function slimListing(r: C21Listing) {
  const precioNum =
    r.precios?.vista?.precio ??
    (typeof r.precio === 'number' ? r.precio : Number(String(r.precio).replace(/[^\d.]/g, '')))

  return {
    id: r.id,
    idOriginal: r.idOriginal,
    title: r.encabezado,
    price: Number.isFinite(precioNum) ? precioNum : null,
    currency: r.precios?.vista?.moneda ?? r.moneda,
    lat: r.lat,
    lon: r.lon,
    m2Construction: r.m2C,
    m2Land: r.m2T,
    bedrooms: r.recamaras,
    bathrooms: r.banos,
    parking: r.estacionamientos,
    municipality: r.municipio,
    municipalitySlug: r.municipioWeb,
    neighborhood: r.colonia,
    street: r.calle,
    state: r.estado,
    operation: r.tipoOperacion,
    propertyType: r.tipoPropiedad,
    url: r.urlCorrectaPropiedad ? `${BASE}${r.urlCorrectaPropiedad}` : null,
    listedAt: r.fechaAlta,
    updatedAt: r.fechaModificacion,
    hasMap: r.conMapa,
    hidePrice: r.ocultarPrecioInternet,
  }
}

export function summarize(listings: ReturnType<typeof slimListing>[]) {
  const withGeo = listings.filter((l) => l.lat != null && l.lon != null && l.hasMap !== false)
  const withPrice = listings.filter((l) => l.price != null && l.price > 0 && !l.hidePrice)
  const withM2 = listings.filter((l) => l.m2Construction && l.m2Construction > 0)
  const munis = new Map<string, number>()
  for (const l of listings) {
    const k = l.municipality || '(empty)'
    munis.set(k, (munis.get(k) ?? 0) + 1)
  }
  return {
    count: listings.length,
    uniqueIds: new Set(listings.map((l) => l.id)).size,
    withGeo: withGeo.length,
    withPrice: withPrice.length,
    withM2Construction: withM2.length,
    topMunicipalities: Object.fromEntries(
      [...munis.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    ),
    sample: listings[0] ?? null,
  }
}
