/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@imno/contracts', '@imno/domain'],
  // Landing assets are pre-compressed webp; skip the optimizer (avoids the sharp dependency).
  images: { unoptimized: true },
  experimental: {
    // Property creation uploads images and GLB models in a single action.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:3001'
    return [
      {
        source: '/api/admin/:path*',
        destination: `${apiUrl}/admin/:path*`,
      },
      {
        source: '/api/graphql',
        destination: `${apiUrl}/graphql`,
      },
    ]
  },
}

export default nextConfig
