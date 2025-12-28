/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'vz-dc8da426-d71.b-cdn.net',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {  // ← HIER: experimental!
      bodySizeLimit: '20mb',
    },
  },
  async redirects() {
    return [
      { source: '/courses', destination: '/mentorship', permanent: true },
      { source: '/courses/:path*', destination: '/mentorship/:path*', permanent: true },
    ]
  },
  // Andere Configs
}

module.exports = nextConfig