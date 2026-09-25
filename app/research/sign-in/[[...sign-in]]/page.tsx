import type { Metadata } from 'next'
import { ResearchAuthCard } from '@/components/research/auth-card'
import { firstSearchParam } from '@/lib/research/ui.mjs'

export const metadata: Metadata = {
  title: 'Sign in',
}

type SearchParams = Record<string, string | string[] | undefined>

export default async function ResearchSignInPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams

  return (
    <div className="m-page r-auth">
      <ResearchAuthCard mode="sign-in" redirectUrl={firstSearchParam(params.redirect_url)} />
    </div>
  )
}
