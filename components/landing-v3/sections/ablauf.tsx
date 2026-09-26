import Image from 'next/image'
import { Drawing } from '@/components/landing-v3/drawing'
import { PLAN_LESSON_SVG, PLAN_LIVE_SVG, PLAN_PO3_SVG } from '@/components/landing-v3/drawings.generated'

const STEPS = [
  {
    svg: PLAN_LESSON_SVG,
    no: '01',
    title: 'Lektionen',
    text: 'Aufgezeichnete Lektionen mit Folien und echten Charts. Du lernst in deinem Tempo und schaust dir alles so oft an, wie du willst.',
  },
  {
    svg: PLAN_PO3_SVG,
    no: '02',
    title: 'ICTs Modelle verstehen',
    text: 'Die Bausteine fügen sich zusammen, so wie ICT sie lehrt: Bias, Liquidität, PD Arrays und Zeit.',
  },
  {
    svg: PLAN_LIVE_SVG,
    no: '03',
    title: 'Live am Markt',
    text: 'Zwei Live-Sessions pro Woche. Wir schauen die Konzepte gemeinsam am aktuellen Markt an, mit meiner Analyse und meinen Überlegungen, auch wenn sie mal nicht aufgeht.',
  },
] as const

export function Ablauf() {
  return (
    <section className="sec" id="ablauf" aria-labelledby="ablauf-title">
      <div className="wrap">
        <div className="head">
          <h2 id="ablauf-title">
            <span className="dim">Erst verstehen.</span>
            <span>Dann am Markt anwenden.</span>
          </h2>
          <p className="lead">
            Den größten Teil der Zeit lernst du die Konzepte in Lektionen. In den Live-Sessions schauen wir gemeinsam, wie sie am aktuellen
            Markt aussehen.
          </p>
        </div>
        <div className="dimrow ratio" role="img" aria-label="Etwa 70 Prozent Lektionen und 30 Prozent live am Markt">
          <div>
            <b>70&nbsp;%</b>
            <span>Lektionen</span>
          </div>
          <div>
            <b>30&nbsp;%</b>
            <span>Live am Markt</span>
            <i className="end" />
          </div>
        </div>
        <ol className="steps">
          {STEPS.map((step) => (
            <li className="step" key={step.no}>
              <Drawing svg={step.svg} />
              <span className="no">{step.no}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="lesson">
          <figure>
            <Image
              src="/landing/slide-16.jpg"
              alt="Folie 16 aus Lektion 1 der Modell-Serie: Der Rücklauf kommt nach der Bestätigung. Zwei-Minuten-Chart des NQ mit markierter Bullish FVG."
              width={1200}
              height={676}
              sizes="(max-width: 900px) calc(100vw - 32px), 680px"
            />
          </figure>
          <div>
            <p className="label">Aus Lektion 1 der Modell-Serie</p>
            <h3>Ein Gedanke pro Folie. Ein echter Chart dazu.</h3>
            <p>
              So sieht eine Lektion aus: Schritt für Schritt erklärt, direkt am Chart. Diese Folie zeigt, wann der Rücklauf in die FVG kommt.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
