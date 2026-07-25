import { type IncomingHttpHeaders, type Server, createServer } from 'node:http'
import type { AgentHandler } from './handler'

/**
 * Thin node:http adapter. It buffers the request body, derives a query-stripped
 * path, normalizes header names to lowercase, and delegates all behavior to the
 * (framework-neutral, testable) handler. Returns the live server instance.
 */
export function startServer(port: number, handler: AgentHandler): Server {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
      const method = req.method ?? 'GET'
      const path = (req.url ?? '/').split('?')[0] ?? '/'
      const headers = normalizeHeaders(req.headers)

      handler
        .handle({ method, path, headers, body })
        .then((result) => {
          res.writeHead(result.status, { 'content-type': 'application/json' })
          res.end(JSON.stringify(result.json))
        })
        .catch(() => {
          res.writeHead(500, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { code: 'MODEL_FAILURE' } }))
        })
    })
  })

  server.listen(port)
  return server
}

function normalizeHeaders(raw: IncomingHttpHeaders): Record<string, string | undefined> {
  const headers: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(raw)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value
  }
  return headers
}
