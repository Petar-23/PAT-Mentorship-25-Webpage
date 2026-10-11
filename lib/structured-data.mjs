// Strukturierte Daten (schema.org, JSON-LD) für Suchmaschinen und KI-Systeme.
//
// Regeln:
// - Auf jeder Seite nur, was für die ganze Website gilt: Organisation, Website, Petar als Person.
// - Kurs, Angebot, Bewertungen und FAQ nur auf der Startseite, weil sie nur dort sichtbar sind.
//   Google wertet Markup, das nicht zum sichtbaren Inhalt passt, als irreführend.
// - Keine Zahl im Markup, die nicht auch auf der Seite steht (Preis, Bewertung aus Whop, FAQ-Text).
// - sameAs nur mit Profilen, die Petar gehören. @PriceActionTrader auf YouTube ist ein fremder Kanal.
//
// Die IDs (@id) verbinden die Teile seitenübergreifend: Artikel verweisen auf dieselbe Person und Organisation.

export const SITE_URL = 'https://www.price-action-trader.de'

export const ORGANIZATION_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`
export const PERSON_ID = `${SITE_URL}/#petar`
export const COURSE_ID = `${SITE_URL}/#mentorship`

export const SOCIAL_PROFILES = {
  youtube: 'https://www.youtube.com/@PriceActionTrader_Petar',
  x: 'https://x.com/petar_trades',
}

/** Absolute URL zu einem Pfad der Website. */
export function absoluteUrl(path = '/') {
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/** Organisation, Website und Person. Gehört in jede Seite (Root-Layout). */
export function siteGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': ORGANIZATION_ID,
        name: 'Price Action Trader',
        alternateName: ['PAT', 'PAT Mentorship'],
        legalName: 'Maric Capital GmbH',
        url: `${SITE_URL}/`,
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/landing/logo.jpg'),
          width: 128,
          height: 128,
        },
        email: 'kontakt@price-action-trader.de',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Karolinenstraße 13',
          postalCode: '64342',
          addressLocality: 'Seeheim-Jugenheim',
          addressCountry: 'DE',
        },
        founder: { '@id': PERSON_ID },
        sameAs: [SOCIAL_PROFILES.youtube, SOCIAL_PROFILES.x],
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'Price Action Trader',
        url: `${SITE_URL}/`,
        inLanguage: 'de-DE',
        publisher: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: 'Petar Maric',
        givenName: 'Petar',
        url: `${SITE_URL}/#petar`,
        image: absoluteUrl('/landing/portrait.jpg'),
        description:
          'Erklärt die Konzepte von ICT (Inner Circle Trader) seit Anfang 2024 in seiner eigenen Mentorship, auf Deutsch und Schritt für Schritt. Handelt Index-Futures.',
        knowsLanguage: ['de', 'en'],
        knowsAbout: [
          'ICT (Inner Circle Trader)',
          'Smart Money Concepts',
          'Fair Value Gap',
          'Liquidität',
          'Premium und Discount',
          'Index-Futures (NQ, ES)',
        ],
        worksFor: { '@id': ORGANIZATION_ID },
        sameAs: [SOCIAL_PROFILES.youtube, SOCIAL_PROFILES.x],
      },
    ],
  }
}

/**
 * Kurs, Angebot und FAQ der Startseite.
 * @param {{
 *   name: string,
 *   description: string,
 *   price: number,
 *   currency: string,
 *   faq: ReadonlyArray<{ q: string, a: string }>,
 *   reviews?: { count: number, average: number } | null,
 * }} input
 */
export function homeGraph({ name, description, price, currency, faq, reviews }) {
  const course = {
    '@type': 'Course',
    '@id': COURSE_ID,
    name,
    description,
    url: `${SITE_URL}/`,
    inLanguage: 'de-DE',
    provider: { '@id': ORGANIZATION_ID },
    offers: {
      '@type': 'Offer',
      category: 'Subscription',
      price: price.toFixed(2),
      priceCurrency: currency,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: price.toFixed(2),
        priceCurrency: currency,
        valueAddedTaxIncluded: true,
        unitCode: 'MON',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
      availability: 'https://schema.org/InStock',
      url: absoluteUrl('/checkout'),
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      inLanguage: 'de-DE',
      instructor: { '@id': PERSON_ID },
    },
  }

  if (reviews && reviews.count > 0 && reviews.average > 0) {
    course.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.average.toFixed(1),
      reviewCount: reviews.count,
      bestRating: '5',
      worstRating: '1',
    }
  }

  const faqPage = {
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/#fragen`,
    inLanguage: 'de-DE',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }

  return { '@context': 'https://schema.org', '@graph': [course, faqPage] }
}

/**
 * Artikel und Breadcrumb für einen Blogbeitrag.
 * @param {{ slug: string, title: string, description: string, date: string, updated?: string, image?: string }} post
 */
export function articleGraph({ slug, title, description, date, updated, image }) {
  const url = absoluteUrl(`/blog/${slug}`)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: title,
        description,
        url,
        mainEntityOfPage: url,
        inLanguage: 'de-DE',
        datePublished: date,
        dateModified: updated || date,
        image: absoluteUrl(image || '/images/pat-banner.jpeg'),
        author: { '@id': PERSON_ID, '@type': 'Person', name: 'Petar Maric', url: `${SITE_URL}/#petar` },
        publisher: { '@id': ORGANIZATION_ID },
        isPartOf: { '@id': WEBSITE_ID },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Start', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: absoluteUrl('/blog') },
          { '@type': 'ListItem', position: 3, name: title, item: url },
        ],
      },
    ],
  }
}

/**
 * JSON für ein <script type="application/ld+json">. "<" wird maskiert, damit Text wie "</script>"
 * aus Inhalten das Skript-Element nicht schließen kann.
 */
export function serializeJsonLd(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
