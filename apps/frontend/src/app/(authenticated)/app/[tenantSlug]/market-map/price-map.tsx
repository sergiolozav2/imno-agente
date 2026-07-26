'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Map as MlMap, MapMouseEvent, Popup as MlPopup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  RAMP,
  formatCompactUsd,
  formatNumber,
  metricValue,
  type Listing,
  type MarketDataset,
  type Metric,
} from './market-data'

export type Basemap = 'light' | 'dark'
export type LayerMode = 'heat' | 'points' | 'both'
export type WeightMode = 'metric' | 'density'

export interface MapControls {
  flyTo: (lng: number, lat: number, zoom?: number) => void
  fitAll: () => void
}

interface PriceMapProps {
  dataset: MarketDataset
  listings: Listing[]
  metric: Metric
  breaks: number[]
  basemap: Basemap
  layerMode: LayerMode
  weightMode: WeightMode
  radius: number
  selectedId: string | null
  controlsRef?: React.RefObject<MapControls | null>
  onSelect: (listing: Listing | null) => void
  onViewportChange: (bounds: { north: number; south: number; east: number; west: number }) => void
  onReady: () => void
}

const SOURCE_ID = 'listings'
const HEAT_LAYER = 'listings-heat'
const POINT_LAYER = 'listings-points'
const SELECTED_LAYER = 'listings-selected'

const TILES: Record<Basemap, { url: string; attribution: string }> = {
  light: {
    url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    attribution: '© OpenStreetMap · © CARTO',
  },
  dark: {
    url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    attribution: '© OpenStreetMap · © CARTO',
  },
}

/**
 * Quantile-equalised 0..1 position for a value: the six break points land on
 * evenly spaced stops so colours spread across the whole ramp instead of
 * bunching up around the median.
 */
function normalize(value: number, breaks: number[]): number {
  const last = breaks.length - 1
  if (value <= breaks[0]!) return 0
  if (value >= breaks[last]!) return 1
  for (let i = 0; i < last; i += 1) {
    const lo = breaks[i]!
    const hi = breaks[i + 1]!
    if (value <= hi) {
      const span = hi - lo || 1
      return (i + (value - lo) / span) / last
    }
  }
  return 1
}

function toGeoJson(listings: Listing[], metric: Metric, breaks: number[]) {
  return {
    type: 'FeatureCollection' as const,
    features: listings.map((l) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.lon, l.lat] },
      properties: {
        id: l.id,
        w: normalize(metricValue(l, metric), breaks),
        price: l.price,
        ppm: l.pricePerM2,
        m2: l.m2,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        zone: l.zone,
        title: l.title,
      },
    })),
  }
}

function tooltipHtml(props: Record<string, unknown>): string {
  const price = formatCompactUsd(Number(props.price))
  const ppm = formatNumber(Number(props.ppm))
  const m2 = formatNumber(Number(props.m2), 0)
  const zone = String(props.zone ?? '')
  return `
    <div class="map-tip">
      <strong class="map-tip-price">${price}</strong>
      <span class="map-tip-meta">$${ppm}/m² · ${m2} m² · ${Number(props.bedrooms)} dorm.</span>
      <span class="map-tip-zone">${zone}</span>
    </div>`
}

export function PriceMap({
  dataset,
  listings,
  metric,
  breaks,
  basemap,
  layerMode,
  weightMode,
  radius,
  selectedId,
  controlsRef,
  onSelect,
  onViewportChange,
  onReady,
}: PriceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const popupRef = useRef<MlPopup | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const loadedRef = useRef(false)
  const listingsRef = useRef(listings)
  listingsRef.current = listings

  // Callbacks live in refs so the map is only ever created once.
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onViewportChangeRef = useRef(onViewportChange)
  onViewportChangeRef.current = onViewportChange
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const emitViewport = useCallback((map: MlMap) => {
    const b = map.getBounds()
    onViewportChangeRef.current({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    })
  }, [])

  useEffect(() => {
    let disposed = false
    const container = containerRef.current
    if (!container) return

    // maplibre is ~250KB gzipped; keep it out of the first paint.
    void import('maplibre-gl').then(({ Map, NavigationControl, ScaleControl, Popup }) => {
      if (disposed || !containerRef.current) return

      const { bbox } = dataset
      const map = new Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            basemap: {
              type: 'raster',
              tiles: [TILES.light.url],
              tileSize: 256,
              attribution: TILES.light.attribution,
            },
          },
          layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
        },
        bounds: [
          [bbox.southWestLng, bbox.southWestLat],
          [bbox.northEastLng, bbox.northEastLat],
        ],
        fitBoundsOptions: { padding: 24 },
        maxZoom: 18,
        minZoom: 9,
        attributionControl: { compact: true },
      })
      mapRef.current = map

      if (controlsRef) {
        controlsRef.current = {
          flyTo: (lng, lat, zoom = 15) => map.flyTo({ center: [lng, lat], zoom, duration: 700 }),
          fitAll: () =>
            map.fitBounds(
              [
                [bbox.southWestLng, bbox.southWestLat],
                [bbox.northEastLng, bbox.northEastLat],
              ],
              { padding: 24, duration: 700 },
            ),
        }
      }

      map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
      map.addControl(new ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-right')

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: 'map-popup',
      })
      popupRef.current = popup

      map.on('load', () => {
        if (disposed) return

        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: toGeoJson(listingsRef.current, metric, breaks),
        })

        map.addLayer({
          id: HEAT_LAYER,
          type: 'heatmap',
          source: SOURCE_ID,
          paint: {
            'heatmap-weight': ['get', 'w'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 16, 2.4],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(37, 99, 235, 0)',
              0.12,
              'rgba(37, 99, 235, 0.55)',
              0.32,
              'rgba(34, 211, 238, 0.7)',
              0.55,
              'rgba(250, 204, 21, 0.8)',
              0.78,
              'rgba(251, 146, 60, 0.88)',
              1,
              'rgba(239, 68, 68, 0.95)',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 24, 13, 38, 16, 76],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.85, 17.5, 0.45],
          },
        })

        map.addLayer({
          id: POINT_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.2, 13, 5.5, 16, 9],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'w'],
              0,
              RAMP[0],
              0.25,
              RAMP[1],
              0.5,
              RAMP[2],
              0.75,
              RAMP[3],
              1,
              RAMP[4],
            ],
            'circle-stroke-width': 1.1,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
            'circle-opacity': 0.92,
          },
        })

        map.addLayer({
          id: SELECTED_LAYER,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['get', 'id'], '__none__'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 16],
            'circle-color': 'rgba(255,255,255,0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#0b0f13',
          },
        })

        map.on('mouseenter', POINT_LAYER, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mousemove', POINT_LAYER, (e: MapMouseEvent & { features?: unknown[] }) => {
          const feature = (e.features as { properties: Record<string, unknown> }[] | undefined)?.[0]
          if (!feature) return
          popup.setLngLat(e.lngLat).setHTML(tooltipHtml(feature.properties)).addTo(map)
        })
        map.on('mouseleave', POINT_LAYER, () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
        })
        map.on('click', POINT_LAYER, (e: MapMouseEvent & { features?: unknown[] }) => {
          const feature = (e.features as { properties: Record<string, unknown> }[] | undefined)?.[0]
          if (!feature) return
          const id = String(feature.properties.id)
          const hit = listingsRef.current.find((l) => l.id === id) ?? null
          onSelectRef.current(hit)
        })
        map.on('click', (e: MapMouseEvent) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: [POINT_LAYER] })
          if (hits.length === 0) onSelectRef.current(null)
        })
        map.on('moveend', () => emitViewport(map))

        loadedRef.current = true
        emitViewport(map)
        onReadyRef.current()
      })

      const observer = new ResizeObserver(() => map.resize())
      observer.observe(container)
      observerRef.current = observer
    })

    return () => {
      disposed = true
      loadedRef.current = false
      observerRef.current?.disconnect()
      observerRef.current = null
      popupRef.current?.remove()
      mapRef.current?.remove()
      mapRef.current = null
      if (controlsRef) controlsRef.current = null
    }
    // Created once: subsequent prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource(SOURCE_ID)
    if (source && 'setData' in source) {
      ;(source as { setData: (d: unknown) => void }).setData(toGeoJson(listings, metric, breaks))
    }
  }, [listings, metric, breaks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    map.setPaintProperty(HEAT_LAYER, 'heatmap-weight', weightMode === 'density' ? 1 : ['get', 'w'])
  }, [weightMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    map.setPaintProperty(HEAT_LAYER, 'heatmap-radius', [
      'interpolate',
      ['linear'],
      ['zoom'],
      10,
      radius * 0.65,
      13,
      radius,
      16,
      radius * 2,
    ])
  }, [radius])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    map.setLayoutProperty(HEAT_LAYER, 'visibility', layerMode === 'points' ? 'none' : 'visible')
    const pointsVisible = layerMode === 'heat' ? 'none' : 'visible'
    map.setLayoutProperty(POINT_LAYER, 'visibility', pointsVisible)
    map.setLayoutProperty(SELECTED_LAYER, 'visibility', pointsVisible)
  }, [layerMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    map.setFilter(SELECTED_LAYER, ['==', ['get', 'id'], selectedId ?? '__none__'])
  }, [selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('basemap')
    if (source && 'setTiles' in source) {
      ;(source as { setTiles: (t: string[]) => void }).setTiles([TILES[basemap].url])
    }
    map.getContainer().dataset.basemap = basemap
  }, [basemap])

  return <div ref={containerRef} className="map-canvas" data-basemap={basemap} />
}
