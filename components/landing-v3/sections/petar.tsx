import Image from 'next/image'
import { YOUTUBE_URL } from '@/components/landing-v3/content'

export function Petar() {
  return (
    <section className="sec" id="petar" aria-labelledby="petar-title">
      <div className="wrap me">
        <Image src="/landing/portrait.jpg" alt="Petar im Studio am Mikrofon" width={800} height={1000} sizes="(max-width: 900px) min(440px, calc(100vw - 32px)), 460px" />
        <div>
          <h2 id="petar-title">
            <span className="dim">Kein Guru.</span>
            <span>Ein Übersetzer für ICT.</span>
          </h2>
          <p className="lead">
            Ich habe über 1.000 Stunden ICT-Material durchgearbeitet: die Private Mentorship, die Mentorships 2022, 2023 und 2024 und die
            Lecture Series 2025. Seit Anfang 2024 erkläre ich diese Konzepte in meiner eigenen Mentorship, auf Deutsch und Schritt für Schritt.
          </p>
          <p className="lead">
            Am Markt liege ich nicht immer richtig, und das siehst du auch. Was ich dir verspreche, sind Verständnis und Struktur. Keine
            Gewinne.
          </p>
          <p className="row">
            <a className="lnk" href={YOUTUBE_URL}>
              Meine Videos auf YouTube
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
