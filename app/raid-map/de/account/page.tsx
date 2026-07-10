import type { Metadata } from 'next'
import RaidMapAccountPage from '@/components/sections/raidmap/account-page'

export const metadata: Metadata = {
  title: 'PAT Raid Map - Dein Account',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default function RaidMapAccountPageDe() {
  return <RaidMapAccountPage lang="de" />
}
