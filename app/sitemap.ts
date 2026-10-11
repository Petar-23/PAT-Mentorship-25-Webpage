import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog'

// Nur indexierbare Seiten mit eigenem Canonical. Nicht hinein gehören: /lp-v1, /lp-v2 und /quick-guide (noindex),
// /checkout und /willkommen (noindex), Mitgliederbereich und Login.
// lastModified nur, wo es ein echtes Datum gibt (Blog). Ein Build-Zeitstempel auf jeder Seite ändert sich bei jedem
// Deploy, Google hält lastmod dann für unzuverlässig und ignoriert es.
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.price-action-trader.de'

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.frontmatter.updated || post.frontmatter.date,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${baseUrl}/blog`, changeFrequency: 'weekly', priority: 0.9 },
    ...blogPosts,
    { url: `${baseUrl}/tools/equity-calculator`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/raid-map`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/raid-map/de`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/raid-map/docs`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/raid-map/docs/de`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/impressum`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/datenschutz`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/AGB`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${baseUrl}/Widerruf`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
