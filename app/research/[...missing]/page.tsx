import { notFound } from 'next/navigation'

// Unbekannte Research-Pfade (z. B. research.…/foo → /research/foo) sollen die
// englische Research-404 im Research-Layout zeigen statt der deutschen Root-404.
// Konkrete Routen (auch spätere wie /notes/[slug]) haben immer Vorrang.
export default function ResearchMissingPage() {
  notFound()
}
