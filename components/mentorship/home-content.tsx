import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr/ArrowRight'
import { BookOpen } from '@phosphor-icons/react/dist/ssr/BookOpen'
import { Play } from '@phosphor-icons/react/dist/ssr/Play'
import { Progress } from '@/components/ui/progress'
import { MentorshipWelcomeName } from './welcome-name'

type Props = {
  courses: Array<{ id: string; name: string; modulesLength: number }>
  continueLearning: {
    moduleId: string; moduleName: string; videoId: string; videoTitle: string; courseName: string | null
    watchedLessons: number; totalLessons: number; percent: number
  } | null
  newContent: Array<{ videoId: string; videoTitle: string; moduleId: string; moduleName: string; courseName: string | null }>
  onboarding?: ReactNode
}

export function MentorshipHomeContent({ courses, continueLearning, newContent, onboarding }: Props) {
  const resumeHref = continueLearning
    ? `/mentorship/modul/${continueLearning.moduleId}?video=${continueLearning.videoId}`
    : courses[0] ? `/mentorship/${courses[0].id}` : null

  return (
    <div className="m-page">
      <div className="m-page-header">
        <div>
          <p className="m-eyebrow">Dein Lernplatz</p>
          <h1 className="m-page-title">Schön, dass du da bist<MentorshipWelcomeName /></h1>
          <p className="m-page-intro">Mach es dir bequem. Der nächste Aha-Moment wartet schon.</p>
        </div>
      </div>
      {onboarding}
      <section className="m-resume" aria-labelledby="resume-heading">
        <div className="m-resume-copy">
          <p className="m-resume-label"><Play weight="fill" aria-hidden="true" />{continueLearning ? 'Hier geht’s weiter' : 'Dein erster Schritt'}</p>
          <h2 id="resume-heading">{continueLearning?.videoTitle ?? 'Zeit, den Chart besser zu verstehen.'}</h2>
          <p className="m-resume-meta">{continueLearning ? [continueLearning.courseName, continueLearning.moduleName].filter(Boolean).join(' · ') : 'Beginne mit einem Kurs. Alles Weitere kommt Schritt für Schritt.'}</p>
          {continueLearning ? (
            <div className="m-resume-progress">
              <Progress value={continueLearning.percent} aria-label="Modulfortschritt" />
              <p>{continueLearning.watchedLessons} von {continueLearning.totalLessons} Lektionen abgeschlossen</p>
            </div>
          ) : <div className="h-6" />}
          {resumeHref ? <Link href={resumeHref} className="m-primary-link" prefetch={false}>{continueLearning ? 'Weiterlernen' : 'Ersten Kurs öffnen'}<ArrowRight aria-hidden="true" /></Link> : <p className="m-resume-meta">Deine Kurse erscheinen hier, sobald sie verfügbar sind.</p>}
        </div>
        <div className="m-resume-art" aria-hidden="true">
          <Image src="/images/mentorship/market-focus.webp" alt="" fill sizes="(max-width: 639px) 100vw, 450px" />
        </div>
      </section>
      <div className="m-home-columns">
        <section aria-labelledby="courses-heading">
          <div className="m-section-heading"><h2 id="courses-heading">Deine Kurse</h2><span>{courses.length} {courses.length === 1 ? 'Kurs' : 'Kurse'}</span></div>
          {courses.length ? courses.map(course => (
            <Link key={course.id} href={`/mentorship/${course.id}`} prefetch={false} className="m-content-row">
              <span className="m-row-icon"><BookOpen aria-hidden="true" /></span>
              <div><h3>{course.name}</h3><p>{course.modulesLength} {course.modulesLength === 1 ? 'Modul' : 'Module'}</p></div>
              <ArrowRight aria-hidden="true" />
            </Link>
          )) : <p className="m-empty">Hier ist noch Platz für deinen ersten Kurs.</p>}
        </section>
        <section aria-labelledby="latest-heading">
          <div className="m-section-heading"><h2 id="latest-heading">Frisch dazugekommen</h2><span>Neue Lektionen</span></div>
          {newContent.length ? newContent.map((item, index) => (
            <Link key={item.videoId} href={`/mentorship/modul/${item.moduleId}?video=${item.videoId}`} prefetch={false} className="m-content-row">
              <span className="m-row-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{item.videoTitle}</h3><p>{item.courseName ? `${item.courseName} · ` : ''}{item.moduleName}</p></div>
              <ArrowRight aria-hidden="true" />
            </Link>
          )) : <p className="m-empty">Alles auf dem aktuellen Stand. Neue Lektionen findest du hier.</p>}
        </section>
      </div>
      <p className="m-quiet-note">Dein Tempo ist das richtige Tempo.</p>
    </div>
  )
}
