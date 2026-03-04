// World Watch — Server Component wrapper
// Auth is handled by Clerk middleware (routes under /dashboard are protected)
// But /world-watch is NOT under /dashboard, so we handle auth here manually.

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import WorldWatchClient from './world-watch-client';

export const metadata = {
  title: 'World Watch — PAT Mentorship',
  description: 'Real-time geopolitical monitoring dashboard',
};

export default async function WorldWatchPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/world-watch');
  }

  return <WorldWatchClient />;
}
