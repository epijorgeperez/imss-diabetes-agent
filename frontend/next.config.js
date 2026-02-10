const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8001',
        pathname: '/files/**',
      },
      {
        protocol: 'http',
        hostname: '11.124.14.201',
        port: '8001',
        pathname: '/files/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8001',
        pathname: '/files/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/files/:path*',
        destination: 'http://127.0.0.1:8001/files/:path*', // Proxy to backend
      },
      {
        source: '/api/admin/:path*',
        destination: 'http://127.0.0.1:8001/admin/:path*', // Proxy admin endpoints
      },
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    return config
  },
}

module.exports = nextConfig

