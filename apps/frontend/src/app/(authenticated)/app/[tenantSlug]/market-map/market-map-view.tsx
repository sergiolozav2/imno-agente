'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  IconChevronsLeft,
  IconLayers,
  IconMapPin,
  IconRefresh,
  IconSliders,
  IconX,
} from '@/components/icons'
import {
  METRIC_LABEL,
  RAMP,
  computeBreaks,
  decodeListings,
  formatCompactUsd,
  formatNumber,
  formatUsd,
  median,
  metricStats,
  metricValue,
  type Listing,
  type MarketDataset,
  type Metric,
} from './market-data'
import {
  PriceMap,
  type Basemap,
  type LayerMode,
  type MapControls,
  type WeightMode,
} from './price-map'

interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

const BEDROOM_OPTIONS = [0, 1, 2, 3, 4] as const

export function MarketMapView({ dataset }: { dataset: MarketDataset }) {
  const all = useMemo(() => decodeListings(dataset), [dataset])

  const [metric, setMetric] = useState<Metric>('pricePerM2')
  const [layerMode, setLayerMode] = useState<LayerMode>('both')
  const [weightMode, setWeightMode] = useState<WeightMode>('metric')
  const [basemap, setBasemap] = useState<Basemap>('light')
  const [radius, setRadius] = useState(38)
  const [priceMax, setPriceMax] = useState(dataset.stats.price.max)
  const [priceMin, setPriceMin] = useState(dataset.stats.price.min)
  const [m2Min, setM2Min] = useState(dataset.stats.m2.min)
  const [bedrooms, setBedrooms] = useState<number>(0)
  const [zones, setZones] = useState<string[]>([])
  const [selected, setSelected] = useState<Listing | null>(null)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [ready, setReady] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(true)
  const [zonesOpen, setZonesOpen] = useState(true)

  const controlsRef = useRef<MapControls | null>(null)

  const filtered = useMemo(
    () =>
      all.filter((l) => {
        if (l.price < priceMin || l.price > priceMax) return false
        if (l.m2 < m2Min) return false
        if (bedrooms > 0 && (bedrooms === 4 ? l.bedrooms < 4 : l.bedrooms !== bedrooms))
          return false
        if (zones.length > 0 && !zones.includes(l.zone)) return false
        return true
      }),
    [all, priceMin, priceMax, m2Min, bedrooms, zones],
  )

  const stats = metricStats(dataset, metric)
  const breaks = useMemo(
    () =>
      computeBreaks(
        filtered.map((l) => metricValue(l, metric)),
        stats.breaks,
      ),
    [filtered, metric, stats.breaks],
  )

  const inView = useMemo(() => {
    if (!bounds) return filtered
    return filtered.filter(
      (l) =>
        l.lat >= bounds.south &&
        l.lat <= bounds.north &&
        l.lon >= bounds.west &&
        l.lon <= bounds.east,
    )
  }, [filtered, bounds])

  const summary = useMemo(() => {
    const ppms = inView.map((l) => l.pricePerM2)
    const prices = inView.map((l) => l.price)
    const sizes = inView.map((l) => l.m2)
    return {
      count: inView.length,
      medianPpm: median(ppms),
      medianPrice: median(prices),
      medianM2: median(sizes),
    }
  }, [inView])

  const zoneRanking = useMemo(() => {
    const groups = new Map<string, Listing[]>()
    for (const l of inView) {
      const list = groups.get(l.zone)
      if (list) list.push(l)
      else groups.set(l.zone, [l])
    }
    const rows = [...groups.entries()].map(([zone, list]) => ({
      zone,
      count: list.length,
      medianPpm: median(list.map((l) => l.pricePerM2)),
      medianPrice: median(list.map((l) => l.price)),
      lat: list.reduce((s, l) => s + l.lat, 0) / list.length,
      lon: list.reduce((s, l) => s + l.lon, 0) / list.length,
    }))
    rows.sort((a, b) => b.medianPpm - a.medianPpm)
    return rows
  }, [inView])

  const maxZonePpm = zoneRanking[0]?.medianPpm ?? 1

  const selectedZoneMedian = useMemo(() => {
    if (!selected) return 0
    return median(filtered.filter((l) => l.zone === selected.zone).map((l) => l.pricePerM2))
  }, [selected, filtered])

  const handleViewportChange = useCallback((next: Bounds) => setBounds(next), [])
  const handleReady = useCallback(() => setReady(true), [])

  const resetFilters = () => {
    setPriceMin(dataset.stats.price.min)
    setPriceMax(dataset.stats.price.max)
    setM2Min(dataset.stats.m2.min)
    setBedrooms(0)
    setZones([])
    setSelected(null)
    controlsRef.current?.fitAll()
  }

  const toggleZone = (zone: string) => {
    setZones((prev) => (prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]))
  }

  useEffect(() => {
    if (!selected) return
    const stillVisible = filtered.some((l) => l.id === selected.id)
    if (!stillVisible) setSelected(null)
  }, [filtered, selected])

  const filtersActive =
    priceMin !== dataset.stats.price.min ||
    priceMax !== dataset.stats.price.max ||
    m2Min !== dataset.stats.m2.min ||
    bedrooms !== 0 ||
    zones.length > 0

  return (
    <div className="map-page" data-basemap={basemap}>
      <PriceMap
        dataset={dataset}
        listings={filtered}
        metric={metric}
        breaks={breaks}
        basemap={basemap}
        layerMode={layerMode}
        weightMode={weightMode}
        radius={radius}
        selectedId={selected?.id ?? null}
        controlsRef={controlsRef}
        onSelect={setSelected}
        onViewportChange={handleViewportChange}
        onReady={handleReady}
      />

      {!ready && (
        <div className="map-loading">
          <span className="map-spinner" aria-hidden="true" />
          Cargando mapa de Santa Cruz…
        </div>
      )}

      {/* Left rail: controls + legend */}
      <div className="map-rail map-rail-left">
        <button
          type="button"
          className="map-rail-toggle"
          onClick={() => setControlsOpen((o) => !o)}
          aria-expanded={controlsOpen}
        >
          <IconSliders width={16} height={16} />
          <span>Filtros{filtersActive ? ' · activos' : ''}</span>
          <IconChevronsLeft
            width={16}
            height={16}
            style={{
              marginLeft: 'auto',
              transform: controlsOpen ? 'rotate(90deg)' : 'rotate(-90deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>

        {controlsOpen && (
          <div className="map-panel map-controls">
            <div className="map-field">
              <span className="map-field-label">Métrica</span>
              <div className="map-segmented">
                {(['pricePerM2', 'price'] as Metric[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`map-segment${metric === m ? ' is-active' : ''}`}
                    onClick={() => setMetric(m)}
                  >
                    {m === 'pricePerM2' ? '$/m²' : 'Precio'}
                  </button>
                ))}
              </div>
            </div>

            <div className="map-field">
              <span className="map-field-label">Capas</span>
              <div className="map-segmented">
                {(
                  [
                    ['both', 'Ambas'],
                    ['heat', 'Calor'],
                    ['points', 'Puntos'],
                  ] as [LayerMode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`map-segment${layerMode === value ? ' is-active' : ''}`}
                    onClick={() => setLayerMode(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {layerMode !== 'points' && (
              <>
                <div className="map-field">
                  <span className="map-field-label">Ponderar calor por</span>
                  <div className="map-segmented">
                    {(
                      [
                        ['metric', 'Valor'],
                        ['density', 'Oferta'],
                      ] as [WeightMode, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`map-segment${weightMode === value ? ' is-active' : ''}`}
                        onClick={() => setWeightMode(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="map-field">
                  <span className="map-field-label">
                    Suavizado <span className="map-field-value">{radius} px</span>
                  </span>
                  <input
                    type="range"
                    min={16}
                    max={70}
                    step={2}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="map-range"
                  />
                </div>
              </>
            )}

            <div className="map-divider" />

            <div className="map-field">
              <span className="map-field-label">
                Precio{' '}
                <span className="map-field-value">
                  {formatCompactUsd(priceMin)} – {formatCompactUsd(priceMax)}
                </span>
              </span>
              <input
                type="range"
                min={dataset.stats.price.min}
                max={dataset.stats.price.max}
                step={5000}
                value={priceMin}
                onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax - 5000))}
                className="map-range"
                aria-label="Precio mínimo"
              />
              <input
                type="range"
                min={dataset.stats.price.min}
                max={dataset.stats.price.max}
                step={5000}
                value={priceMax}
                onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin + 5000))}
                className="map-range"
                aria-label="Precio máximo"
              />
            </div>

            <div className="map-field">
              <span className="map-field-label">
                Superficie mínima <span className="map-field-value">{formatNumber(m2Min)} m²</span>
              </span>
              <input
                type="range"
                min={dataset.stats.m2.min}
                max={dataset.stats.m2.max}
                step={5}
                value={m2Min}
                onChange={(e) => setM2Min(Number(e.target.value))}
                className="map-range"
              />
            </div>

            <div className="map-field">
              <span className="map-field-label">Dormitorios</span>
              <div className="map-segmented">
                {BEDROOM_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`map-segment${bedrooms === n ? ' is-active' : ''}`}
                    onClick={() => setBedrooms(n)}
                  >
                    {n === 0 ? 'Todos' : n === 4 ? '4+' : n}
                  </button>
                ))}
              </div>
            </div>

            <div className="map-field">
              <span className="map-field-label">Zonas</span>
              <div className="map-chips">
                {dataset.zones.map((zone) => (
                  <button
                    key={zone}
                    type="button"
                    className={`map-chip${zones.includes(zone) ? ' is-active' : ''}`}
                    onClick={() => toggleZone(zone)}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>

            <div className="map-divider" />

            <div className="map-actions">
              <button
                type="button"
                className="map-ghost-btn"
                onClick={() => setBasemap((b) => (b === 'light' ? 'dark' : 'light'))}
              >
                <IconLayers width={15} height={15} />
                {basemap === 'light' ? 'Base oscura' : 'Base clara'}
              </button>
              <button type="button" className="map-ghost-btn" onClick={resetFilters}>
                <IconRefresh width={15} height={15} />
                Reiniciar
              </button>
            </div>
          </div>
        )}

        <div className="map-panel map-legend">
          <div className="map-legend-head">
            <span className="map-legend-title">{METRIC_LABEL[metric]}</span>
            <span className="map-legend-sub">{metric === 'pricePerM2' ? 'USD por m²' : 'USD'}</span>
          </div>
          <div
            className="map-legend-bar"
            style={{ background: `linear-gradient(90deg, ${RAMP.join(', ')})` }}
          />
          <div className="map-legend-scale">
            {breaks.map((value, i) => (
              <span key={i}>
                {metric === 'price' ? formatCompactUsd(value) : `$${formatNumber(value)}`}
              </span>
            ))}
          </div>
          <p className="map-legend-note">
            {layerMode === 'points'
              ? 'Cada punto es un departamento en venta.'
              : weightMode === 'metric'
                ? 'El calor combina concentración de avisos y nivel de precio.'
                : 'El calor muestra dónde se concentra la oferta, sin ponderar precio.'}
          </p>
        </div>
      </div>

      {/* Right rail: live stats + zone ranking */}
      <div className="map-rail map-rail-right">
        <div className="map-panel map-stats">
          <div className="map-stats-head">
            <span className="map-panel-title">En pantalla</span>
            <span className="map-badge">{formatNumber(summary.count)} avisos</span>
          </div>
          <div className="map-stats-grid">
            <div>
              <span className="map-stat-value">
                {summary.count ? `$${formatNumber(summary.medianPpm)}` : '—'}
              </span>
              <span className="map-stat-label">mediana $/m²</span>
            </div>
            <div>
              <span className="map-stat-value">
                {summary.count ? formatCompactUsd(summary.medianPrice) : '—'}
              </span>
              <span className="map-stat-label">mediana precio</span>
            </div>
            <div>
              <span className="map-stat-value">
                {summary.count ? `${formatNumber(summary.medianM2)} m²` : '—'}
              </span>
              <span className="map-stat-label">mediana sup.</span>
            </div>
          </div>
        </div>

        <div className="map-panel map-zones">
          <button
            type="button"
            className="map-panel-head-btn"
            onClick={() => setZonesOpen((o) => !o)}
            aria-expanded={zonesOpen}
          >
            <span className="map-panel-title">Zonas por $/m²</span>
            <IconChevronsLeft
              width={16}
              height={16}
              style={{
                marginLeft: 'auto',
                transform: zonesOpen ? 'rotate(90deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          </button>
          {zonesOpen && (
            <ul className="map-zone-list">
              {zoneRanking.length === 0 && (
                <li className="map-zone-empty">Sin datos en pantalla</li>
              )}
              {zoneRanking.map((row) => (
                <li key={row.zone}>
                  <button
                    type="button"
                    className={`map-zone-row${zones.includes(row.zone) ? ' is-active' : ''}`}
                    onClick={() => {
                      toggleZone(row.zone)
                      controlsRef.current?.flyTo(row.lon, row.lat, 14)
                    }}
                  >
                    <span className="map-zone-name">{row.zone}</span>
                    <span className="map-zone-bar">
                      <span
                        className="map-zone-bar-fill"
                        style={{ width: `${(row.medianPpm / maxZonePpm) * 100}%` }}
                      />
                    </span>
                    <span className="map-zone-value">${formatNumber(row.medianPpm)}</span>
                    <span className="map-zone-count">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="map-source">
            {formatNumber(dataset.stats.count)} departamentos en venta · {dataset.source} ·{' '}
            {new Date(dataset.generatedAt).toLocaleDateString('es-BO')}
          </p>
        </div>
      </div>

      {selected && (
        <div className="map-panel map-detail">
          <button
            type="button"
            className="map-detail-close"
            onClick={() => setSelected(null)}
            aria-label="Cerrar"
          >
            <IconX width={16} height={16} />
          </button>
          <div className="map-detail-head">
            <span className="map-detail-price">{formatUsd(selected.price)}</span>
            <span className="map-detail-ppm">${formatNumber(selected.pricePerM2)} / m²</span>
          </div>
          <p className="map-detail-title">{selected.title || 'Departamento en venta'}</p>
          <p className="map-detail-address">
            <IconMapPin width={14} height={14} />
            {[selected.street, selected.zone].filter(Boolean).join(' · ')}
          </p>
          <div className="map-detail-specs">
            <span>{formatNumber(selected.m2)} m²</span>
            <span>{selected.bedrooms} dorm.</span>
            <span>{selected.bathrooms} baños</span>
            <span>{selected.parking} parqueo</span>
          </div>
          {selectedZoneMedian > 0 && (
            <p
              className={`map-detail-delta${
                selected.pricePerM2 >= selectedZoneMedian ? ' is-above' : ' is-below'
              }`}
            >
              {Math.abs(Math.round((selected.pricePerM2 / selectedZoneMedian - 1) * 100))}%
              {selected.pricePerM2 >= selectedZoneMedian ? ' sobre' : ' bajo'} la mediana de{' '}
              {selected.zone} (${formatNumber(selectedZoneMedian)}/m²)
            </p>
          )}
          <div className="map-detail-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => controlsRef.current?.flyTo(selected.lon, selected.lat, 16.5)}
            >
              Centrar
            </button>
            {selected.url && (
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
              >
                Ver aviso
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
