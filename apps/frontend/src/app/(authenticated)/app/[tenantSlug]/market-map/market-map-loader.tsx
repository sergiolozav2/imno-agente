'use client'

import { useEffect, useState } from 'react'
import type { MarketDataset } from './market-data'
import { MarketMapView } from './market-map-view'

const DATASET_URL = '/data/santa-cruz-market.json'

export function MarketMapLoader() {
  const [dataset, setDataset] = useState<MarketDataset | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(DATASET_URL, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<MarketDataset>
      })
      .then((data) => {
        if (!cancelled) setDataset(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="map-page">
        <div className="map-loading">No se pudo cargar el dataset del mercado ({error}).</div>
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="map-page">
        <div className="map-loading">
          <span className="map-spinner" aria-hidden="true" />
          Cargando datos del mercado…
        </div>
      </div>
    )
  }

  return <MarketMapView dataset={dataset} />
}
