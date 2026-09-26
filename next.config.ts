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
        hostname: 'vz-08bb86cc-ee1.b-cdn.net',
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
  async headers() {
    return [
      {
        // Trailer der Landingpage: versionierter Dateiname (trailer-v4.mp4), deshalb lange cachebar.
        // Neue Fassung immer unter neuem Namen ablegen, nie eine bestehende Datei überschreiben.
        source: '/landing/:file(trailer-[^/]+\\.mp4)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
  async redirects() {
    // /agb und /widerruf leitet middleware.ts weiter (lib/legal-path-aliases.mjs).
    // Hier ginge es nicht: Next vergleicht source ohne Groß-/Kleinschreibung,
    // eine Regel /agb -> /AGB würde auch /AGB treffen und endlos weiterleiten.
    return [
      { source: '/courses', destination: '/mentorship', permanent: true },
      { source: '/courses/:path*', destination: '/mentorship/:path*', permanent: true },
    ]
  },
  // Andere Configs
}

module.exports = nextConfig
