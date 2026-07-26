# Century 21 Bolivia (c21.com.bo) experiments

Public JSON search — append `?json=true` to result URLs. No cookies required.

```
GET /v/resultados/tipo_{tipo}/operacion_{venta|renta}/en-pais_bolivia/en-estado_santa-cruz/ordenado-por_fecha-de-alta_descendiente[/pagina_N]?json=true
```

- `totalHits` is exact (`eq`)
- ~100 results per page
- Listings include numeric `precio`, `lat`/`lon`, `m2C`/`m2T`, `recamaras`, `municipio`, etc.

## Run

```bash
pnpm tsx scripts/c21/fetch-search.ts --tipo=departamento --operacion=venta --save
pnpm tsx scripts/c21/fetch-search.ts --tipo=casa --operacion=venta --delay-ms=500 --save
# optional raw payload:
pnpm tsx scripts/c21/fetch-search.ts --tipo=departamento --operacion=venta --save --full
```

Outputs → `scripts/c21/out/` (gitignored)

## Feeding the price map

The `Mapa de precios` page reads a single static file. Rebuild it after every
scrape — it merges every dump in `out/`, drops outliers, and precomputes the
quantile breaks and zone aggregates used by the legend and the ranking panel:

```bash
pnpm map:data
# or a single dump:
pnpm tsx scripts/c21/build-map-data.ts --in=scripts/c21/out/departamento-venta-….json
```

Output → `apps/frontend/public/data/santa-cruz-market.json` (committed, ~180 KB
raw / ~50 KB gzipped). Only listings inside the Santa Cruz city bounding box
declared at the top of `build-map-data.ts` are kept.

Note: the frontend pins `maplibre-gl` to v5 — v6 loads its GeoJSON worker from a
relative URL that Next's bundler does not resolve, which silently leaves every
layer empty.
