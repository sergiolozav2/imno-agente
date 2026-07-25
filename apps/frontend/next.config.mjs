/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@imno/contracts', '@imno/domain'],
}

export default nextConfig
