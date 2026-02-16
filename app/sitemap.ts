import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://price-action-trader.de'
  const now = new Date().toISOString()

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/AGB`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/Widerruf`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/tools/equity-calculator`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/lp-v1`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/lp-v2`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
