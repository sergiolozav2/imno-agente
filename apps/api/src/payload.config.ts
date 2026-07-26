import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteD1Adapter } from '@payloadcms/db-d1-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { lazyD1, lazyR2 } from './cloudflare'
import { collections } from './collections'
import { globals } from './globals'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * The D1 and R2 bindings are lazy proxies resolved at first use (see
 * cloudflare.ts) so the config can be imported before the local wrangler
 * platform proxy is initialized. Media bytes live in R2 under the
 * `media-assets` upload collection.
 */
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'local-dev-payload-secret',
  admin: {
    user: 'users',
  },
  editor: lexicalEditor(),
  collections,
  globals,
  db: sqliteD1Adapter({ binding: lazyD1 as unknown as D1Database }),
  plugins: [
    r2Storage({
      bucket: lazyR2 as unknown as R2Bucket,
      collections: { 'media-assets': true },
    }),
  ],
  // No `sharp`: it is a native binary and cannot run on workerd. Uploads are
  // stored in R2 at their original size and no resized variants are generated.
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
