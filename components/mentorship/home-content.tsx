import { ArrowRight, Check, FileText, Play } from '@/components/mentorship/icons'
import type { ReactNode } from 'react'
import { MentorshipLink as Link } from './navigation-link'
import Image from 'next/image'
import { Progress } from '@/components/ui/progress'
import { formatLearningDuration } from '@/lib/mentorship-learning'
import type { CourseLearningProgress, LearningTarget, NewLearningContent } from '@/lib/mentorship-learning'
import { MentorshipWelcomeName } from './welcome-name'

type Props = {
  courses: CourseLearningProgress[]
  continueLearning: LearningTarget | null
  newContent: NewLearningContent[]
  onboarding?: ReactNode
}

const labels = {
  'last-opened': 'Zuletzt geöffnet', next: 'Als Nächstes', gap: 'Noch offen',
  'next-module': 'Nächstes Modul', start: 'Dein Start',
}
const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Berlin' })

function LearningCard({ target }: { target: LearningTarget }) {
  const isLesson = target.kind === 'lesson'
  const moduleHref = target.kind !== 'completed' && target.moduleId ? `/mentorship/modul/${target.moduleId}` : null
  const courseHref = `/mentorship/${target.courseId}`
  const href = isLesson ? `${moduleHref}?video=${target.videoId}` : moduleHref ?? courseHref
  const label = isLesson ? labels[target.reason] : target.kind === 'completed' ? 'Kurs abgeschlossen' : 'Weitere Lektionen folgen'
  const title = isLesson ? target.videoTitle : target.kind === 'completed' ? target.courseName : target.moduleName ?? target.courseName
  const meta = isLesson
    ? [target.courseName, target.moduleName, `Lektion ${target.position} von ${target.totalLessons}`, target.isPdf ? 'PDF' : formatLearningDuration(target.duration)].filter(Boolean).join(' · ')
    : target.kind === 'waiting' && target.moduleName
      ? target.hasAvailableLessons ? `Alle verfügbaren Lektionen in ${target.courseName} sind abgeschlossen.` : `In ${target.courseName} ist noch kein Lernmaterial verfügbar.`
      : null
  const action = isLesson
    ? target.reason === 'last-opened' ? 'Weiterlernen' : target.reason === 'start' ? 'Erste Lektion starten' : 'Lektion starten'
    : target.kind === 'completed' ? 'Kurs öffnen' : moduleHref ? 'Modulübersicht öffnen' : 'Kurs öffnen'

  return <section className="m-resume" aria-labelledby="resume-heading" data-learning-state={isLesson ? target.reason : target.kind}>
    <div className="m-resume-copy">
      <p className="m-resume-label">{target.kind === 'completed' ? <Check aria-hidden="true" /> : isLesson ? target.isPdf ? <FileText aria-hidden="true" /> : <Play aria-hidden="true" /> : null}{label}</p>
      <h2 id="resume-heading">{title}</h2>
      {meta ? <p className="m-resume-meta">{meta}</p> : null}
      {target.totalLessons > 0 ? <div className="m-resume-progress">
        {target.kind !== 'completed' ? <Progress value={target.percent} aria-label={`Fortschritt ${target.moduleName ? `im Modul ${target.moduleName}` : `im Kurs ${target.courseName}`}`} /> : null}
        <p>{target.completedLessons} von {target.totalLessons} Lektionen abgeschlossen</p>
      </div> : null}
      <div className="m-resume-actions">
        <Link href={href} className="m-primary-link" prefetch={false}>{action}<ArrowRight aria-hidden="true" /></Link>
        {isLesson ? <Link href={target.reason === 'start' ? courseHref : moduleHref ?? courseHref} className="m-text-link" prefetch={false}>{target.reason === 'start' ? 'Kursübersicht' : 'Modulübersicht'}</Link> : null}
      </div>
    </div>
    <div className="m-resume-art" aria-hidden="true">
      <Image src="/images/mentorship/market-focus.webp" alt="" fill sizes="(max-width: 639px) 64px, 360px" />
    </div>
  </section>
}

export function MentorshipHomeContent({ courses, continueLearning, newContent, onboarding }: Props) {
  return <div className="m-page">
    <div className="m-page-header"><div>
      <p className="m-eyebrow">Übersicht</p>
      <h1 className="m-page-title">Schön, dass du da bist<MentorshipWelcomeName /></h1>
    </div></div>
    {continueLearning ? <LearningCard target={continueLearning} /> : null}
    {onboarding}
    {!courses.length ? <p className="m-dashboard-empty">Deine Kurse erscheinen hier, sobald sie verfügbar sind.</p> : <div className="m-home-columns">
      <section aria-labelledby="courses-heading">
        <div className="m-section-heading"><h2 id="courses-heading">Kurse</h2></div>
        {courses.map(course => {
          const completed = course.totalLessons > 0 && course.completedLessons === course.totalLessons
          const moduleLabel = `${course.modulesLength} ${course.modulesLength === 1 ? 'Modul' : 'Module'}`
          const progressLabel = completed ? 'Abgeschlossen' : course.totalLessons === 0 ? 'Lektionen folgen'
            : course.completedLessons === null ? `${course.totalLessons} Lektionen` : `${course.completedLessons} von ${course.totalLessons} Lektionen abgeschlossen`
          return <Link key={course.id} href={`/mentorship/${course.id}`} prefetch={false} className="m-content-row" data-completed={completed}>
            <div>
              <h3>{completed ? <Check aria-hidden="true" /> : null}{course.name}</h3>
              <p>{progressLabel} · {moduleLabel}</p>
              {!completed && course.totalLessons > 0 && course.percent !== null ? <div className="m-course-progress"><Progress value={course.percent} aria-label={`Fortschritt im Kurs ${course.name}`} /></div> : null}
            </div>
          </Link>
        })}
      </section>
      {newContent.length ? <section aria-labelledby="latest-heading">
        <div className="m-section-heading"><h2 id="latest-heading">Neue Lektionen</h2><span>Hinzugefügt</span></div>
        {newContent.map(item => <Link key={item.videoId} href={`/mentorship/modul/${item.moduleId}?video=${item.videoId}`} prefetch={false} className="m-content-row" data-completed={item.watched}>
          <div>
            <h3>{item.watched ? <Check aria-hidden="true" /> : null}{item.videoTitle}</h3>
            <p>{[item.watched ? 'Abgeschlossen' : null, item.courseName, item.moduleName, item.isPdf ? 'PDF' : null].filter(Boolean).join(' · ')}</p>
          </div>
          <time dateTime={item.addedAt}><span className="sr-only">Hinzugefügt am </span>{dateFormat.format(new Date(item.addedAt))}</time>
        </Link>)}
      </section> : null}
    </div>}
  </div>
}
