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
}

module.exports = nextConfig

