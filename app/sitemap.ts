import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'
import { PFADE } from '@/components/prop-firm-rechner/pfade'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.price-action-trader.de'
  const now = new Date().toISOString()
  // Prop-Firm-Rechner auf Deutsch und Englisch: beide Einträge nennen sich gegenseitig (hreflang)
  const rechnerSprachen = { de: `${baseUrl}${PFADE.de}`, en: `${baseUrl}${PFADE.en}` }

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.frontmatter.date,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
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
      url: `${baseUrl}${PFADE.de}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: rechnerSprachen },
    },
    {
      url: `${baseUrl}${PFADE.en}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: rechnerSprachen },
    },
    {
      url: `${baseUrl}/raid-map`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/raid-map/de`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/raid-map/docs`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/raid-map/docs/de`,
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
    ...blogPosts,
  ]
}
