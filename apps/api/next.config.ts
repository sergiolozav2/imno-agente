import { withPayload } from '@payloadcms/next/withPayload'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import path from 'path'

type WebpackConfig = {
  module: {
    rules: unknown[]
  }
  plugins: {
    push: (...plugins: unknown[]) => number
  }
  resolve: {
    extensionAlias?: Record<string, string[]>
  }
}

type WebpackModule = {
  NormalModuleReplacementPlugin: new (
    resourceRegExp: RegExp,
    newResource: (resource: { context?: string; request: string }) => void,
  ) => unknown
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Worker bundle is produced by `opennextjs-cloudflare build`, which reads
  // the default Next output. Tracing still has to start at the repo root so the
  // hoisted node_modules and the `@imno/*` sources are followed.
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  outputFileTracingExcludes: {
    '**/*': ['**/next/dist/compiled/@vercel/og/**'],
  },

  // Payload's admin panel is heavy; workerd has no image optimizer and `sharp`
  // cannot run there, so images are served as uploaded.
  images: {
    unoptimized: true,
  },

  // Packages with Cloudflare Workers (workerd) specific code.
  // https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ['jose', 'pg-cloudflare'],

  // Shared workspace packages ship raw TS and must be transpiled by Next.
  transpilePackages: [
    '@imno/contracts',
    '@imno/domain',
    '@imno/runtime-config',
    '@imno/agent-core',
    '@imno/content-core',
    '@imno/integration-evolution',
    '@imno/integration-llm',
    '@imno/integration-ffmpeg',
  ],

  webpack: (webpackConfig: WebpackConfig, { webpack }: { webpack: WebpackModule }) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    webpackConfig.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/\.\/og\/index\.js$/, (resource) => {
        if (
          typeof resource.context === 'string' &&
          resource.context.includes(
            `${path.sep}@payloadcms${path.sep}next${path.sep}dist${path.sep}routes${path.sep}rest`,
          )
        ) {
          resource.request = path.resolve(process.cwd(), 'src/lib/payload-og-disabled.ts')
        }
      }),
    )

    webpackConfig.module.rules.push({
      test: /\.md$/,
      type: 'asset/source',
    })

    return webpackConfig
  },
}

// Gives `next dev` the same D1/R2 bindings the deployed Worker gets, so
// `getCloudflareContext()` resolves in development too.
void initOpenNextCloudflareForDev({ configPath: 'wrangler.jsonc', environment: 'local' })

export default withPayload(nextConfig, { devBundleServerPackages: false })
