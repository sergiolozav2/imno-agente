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

Outputs → `scripts/c21/out/`
