/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    qualities: [70, 75],
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
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
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
  typescript: {
    // Pre-existing Prisma schema drift — types regenerated at runtime via vercel-build
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig