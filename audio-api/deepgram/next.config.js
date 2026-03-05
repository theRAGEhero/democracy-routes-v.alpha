/** @type {import('next').NextConfig} */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')

const nextConfig = {
  basePath,
  assetPrefix: basePath || undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
}

module.exports = nextConfig
