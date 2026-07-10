import { MENTORSHIP_CONFIG } from '@/lib/config'

export function JsonLd() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Price Action Trader',
    alternateName: 'PAT Mentorship',
    url: 'https://price-action-trader.de',
    logo: 'https://price-action-trader.de/favicon.ico',
    description:
      'Live-Mentoring für Trading nach ICT Smart Money Konzepten — auf Deutsch.',
    address: { '@type': 'PostalAddress', addressCountry: 'DE' },
    sameAs: ['https://www.youtube.com/@PriceActionTrader'],
  }

  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'PAT Mentorship 2026',
    description:
      `Live-Mentoring-Programm für Trading nach ICT Smart Money Konzepten. ${MENTORSHIP_CONFIG.sessionsPerWeek} Live-Sessions pro Woche, auf Deutsch.`,
    provider: {
      '@type': 'Organization',
      name: 'Price Action Trader',
      url: 'https://price-action-trader.de',
    },
    instructor: {
      '@type': 'Person',
      name: 'Petar',
      jobTitle: 'ICT Trading Mentor',
      description:
        'Spezialisiert auf ICT Smart Money Konzepte. Über 1000 Stunden ICT-Videomaterial studiert. 130+ erfolgreiche Mentees seit 2024.',
      url: 'https://price-action-trader.de',
    },
    inLanguage: 'de',
    educationalLevel: 'Beginner to Advanced',
    offers: {
      '@type': 'Offer',
      price: MENTORSHIP_CONFIG.price.toFixed(2),
      priceCurrency: MENTORSHIP_CONFIG.currency,
      availability: 'https://schema.org/InStock',
      url: 'https://price-action-trader.de',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: '48',
      bestRating: '5',
      worstRating: '1',
    },
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Was ist das PAT Mentorship?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Das PAT Mentorship ist ein Live-Mentoring-Programm für Trading nach ICT Smart Money Konzepten. Du lernst in ${MENTORSHIP_CONFIG.sessionsPerWeek} Live-Sessions pro Woche, auf Deutsch, direkt von Mentor Petar.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Wie viel kostet das Mentorship?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Das PAT Mentorship kostet ${MENTORSHIP_CONFIG.price} € pro Monat und ist mit 1 Tag Frist zum Monatsende kündbar. Es gibt keine langfristigen Verträge.`,
        },
      },
      {
        '@type': 'Question',
        name: 'Brauche ich Vorkenntnisse?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Nein, das Programm ist für Anfänger bis Fortgeschrittene geeignet. Du lernst alles Schritt für Schritt.',
        },
      },
      {
        '@type': 'Question',
        name: 'Was sind ICT Konzepte?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'ICT (Inner Circle Trader) Konzepte sind Smart Money Strategien, die sich auf institutionelles Orderflow, Liquidität und Price Action fokussieren.',
        },
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  )
}
