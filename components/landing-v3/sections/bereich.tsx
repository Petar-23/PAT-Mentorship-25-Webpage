import Image from 'next/image'
import { SiDiscord } from '@icons-pack/react-simple-icons'
import { COURSES } from '@/components/landing-v3/content'

const SHOT_ALT = 'Mitgliederbereich: Startseite mit Weiterlernen-Karte und Kursen (Beispielansicht)'
const SHOT_SIZES = '(max-width: 900px) calc(100vw - 32px), 700px'

export function Bereich() {
  return (
    <section className="sec" id="bereich" aria-labelledby="bereich-title">
      <div className="wrap">
        <div className="head">
          <h2 id="bereich-title">
            <span className="dim">Dein Mitgliederbereich.</span>
            <span>Alles an einem Ort.</span>
          </h2>
          <p className="lead">
            Lektionen, Aufzeichnungen und Kurse findest du im Mitgliederbereich. Fragen und Austausch laufen in der Community auf Discord.
          </p>
        </div>
        <div className="bento">
          <div className="tile">
            <div className="shot">
              {/* Nur das zum Farbschema passende Bild ist sichtbar; das andere lädt nicht (lazy und display:none). */}
              <Image className="light" src="/landing/app-light.jpg" alt={SHOT_ALT} width={1440} height={1000} sizes={SHOT_SIZES} />
              <Image className="dark" src="/landing/app-dark.jpg" alt={SHOT_ALT} width={1440} height={1000} sizes={SHOT_SIZES} />
              <span className="shot-note">Beispielansicht</span>
            </div>
            <div className="tcap">
              <b>Dein Lernplatz</b>
              <span>Hier machst du weiter, wo du aufgehört hast. Im Tag- und Nachtmodus, wie diese Seite.</span>
            </div>
          </div>
          <div className="tile dc">
            <div className="hd">
              <span className="lg">
                <SiDiscord aria-hidden="true" />
              </span>
              <b>PAT Community</b>
              <small>Discord</small>
            </div>
            <div className="msg">
              <span className="av" aria-hidden="true">
                <Image src="/landing/logo.jpg" alt="" width={40} height={40} sizes="40px" />
              </span>
              <div>
                <p className="nm">
                  Petar <small>Dienstag</small>
                </p>
                <div className="tx">
                  <p>
                    <strong>Dienstag nach der großen Montags-Expansion</strong>
                  </p>
                  <p>Moin zusammen, für heute schraube ich die Erwartung an einen weiteren sauberen Trendtag erst einmal herunter.</p>
                  <p>Mein Plan für heute:</p>
                  <ul>
                    <li>Die erste Stunde nach dem US-Open beobachten, danach neu bewerten.</li>
                    <li>Überlappen die Kerzen und wechselt die Richtung ständig, skippen wir.</li>
                  </ul>
                  <p>
                    <strong>Heute erst den Read abwarten. Ein Tag ohne Trade ist völlig okay.</strong>
                  </p>
                </div>
              </div>
            </div>
            <div className="tcap">
              <b>Community auf Discord</b>
              <span>Ein Marktausblick aus der Community</span>
            </div>
          </div>
        </div>
        <div className="courses">
          {COURSES.map((course) => (
            <div className="course" key={course.title}>
              <Image src={course.src} alt="" width={1200} height={675} sizes="(max-width: 900px) calc(100vw - 32px), 380px" />
              <div>
                <b>{course.title}</b>
                <span>{course.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
