import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getCustomerPreview } from '@/lib/customer-preview'
import { getSidebarData } from '@/lib/sidebar-data'
import { CustomerPreviewProvider } from '@/components/mentorship/customer-preview-context'
import { MentorshipShell } from '@/components/mentorship/shell'
import { MobileCoursesDrawer } from '@/components/mobile-courses-drawer'
import { MentorshipHomeView } from '@/components/mentorship/views/home-view'
import { MentorshipCourseView } from '@/components/mentorship/views/course-view'
import { MentorshipModuleView } from '@/components/mentorship/views/module-view'
import { mentorshipSans, mentorshipSerif } from '@/app/mentorship/fonts'
import '@/app/mentorship/mentorship.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'Kundenvorschau · PAT', robots: { index: false, follow: false } }

export default async function CustomerPreviewPage({ params, searchParams }: {
  params: Promise<{ userId: string; path?: string[] }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId, path = [] } = await params
  // Page-level guard is intentional: layouts are reused across client navigation.
  const preview = await getCustomerPreview(userId)
  if (!preview.ok) notFound()
  const uuid = /^[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/
  const isHome = path.length === 0
  const isCourse = path.length === 1 && uuid.test(path[0])
  const isModule = path.length === 2 && path[0] === 'modul' && uuid.test(path[1])
  if (!isHome && !isCourse && !isModule) notFound()

  const preferences = await cookies()
  const theme = preferences.get('pat-mentorship-theme')?.value === 'dark' ? 'dark' : 'light'
  const navigation = preview.access.allowed ? await getSidebarData() : null
  const content = !preview.access.allowed
    ? <main className="m-page m-page-scroll"><h1 className="m-page-title">Kein Zugang zur Mentorship</h1>
      <p className="m-page-intro">{preview.reason}</p>
      <p className="mt-4">Deine Adminrechte werden in dieser Vorschau nicht als Kundenzugang verwendet.</p></main>
    : isHome ? <MentorshipHomeView userId={userId} isAdmin={false} searchParams={searchParams} />
    : isCourse ? <MentorshipCourseView id={path[0]} userId={userId} isAdmin={false} />
    : <MentorshipModuleView id={path[1]} userId={userId} isAdmin={false} searchParams={searchParams} />

  return <>
    <div hidden data-hide-root-footer="true" />
    <CustomerPreviewProvider customer={preview.customer}>
      <MentorshipShell key={userId} initialTheme={theme} className={`m-pat-fonts ${mentorshipSans.variable} ${mentorshipSerif.variable}`}
        headerNavigation={navigation ? <MobileCoursesDrawer isAdmin={false} kurse={navigation.kurseForSidebar}
          pages={navigation.pagesForSidebar} savedSidebarOrder={navigation.savedSidebarOrder} /> : null}>
        {content}
      </MentorshipShell>
    </CustomerPreviewProvider>
  </>
}
