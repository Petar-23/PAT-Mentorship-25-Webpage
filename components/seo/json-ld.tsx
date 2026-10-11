import { serializeJsonLd } from '@/lib/structured-data.mjs'

/**
 * Ein JSON-LD-Block. Inhalt kommt aus lib/structured-data.mjs.
 * Das Root-Layout setzt siteGraph() (Organisation, Website, Person) auf jede Seite.
 * Kurs und FAQ setzt nur die Startseite, Artikel nur die Blogbeiträge.
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
