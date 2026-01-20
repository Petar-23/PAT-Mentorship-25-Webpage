import { Card } from '@/components/ui/card'

const steps = [
  {
    day: 'Tag 1',
    title: 'Video 1: Die 3 wichtigsten ICT‑Konzepte',
    description:
      'Du bekommst die Grundlagen, die du wirklich brauchst – ohne 700 Videos.',
  },
  {
    day: 'Tag 2',
    title: 'Video 2: ICT Modell 22 + FVG‑Einstieg',
    description:
      'Du lernst das Modell 22 Setup und die Einstiegstechnik FVG.',
  },
  {
    day: 'Tag 3',
    title: 'Video 3: Trading‑Plan & Checkliste',
    description:
      'Du erhältst den fertigen Trading‑Plan und die Modell‑22‑Checkliste als PDF.',
  },
]

export default function LeadMagnetSteps() {
  return (
    <section className="bg-neutral-50 px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-4">
          <p className="text-pretty text-sm font-medium text-blue-700">
            Dein 3‑Tage‑Plan
          </p>
          <h2 className="text-balance text-3xl font-semibold text-neutral-950 sm:text-4xl">
            Drei Klare Schritte, Ein Ziel
          </h2>
          <p className="text-pretty text-base text-neutral-700 sm:text-lg">
            Drei Videos statt 700+ ICT‑Videos, geliefert per E‑Mail.
          </p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {steps.map(step => (
            <Card key={step.day} className="border-blue-100 p-6">
              <p className="text-pretty text-xs font-medium text-blue-700">
                {step.day}
              </p>
              <h3 className="text-balance mt-2 text-xl font-semibold text-neutral-950">
                {step.title}
              </h3>
              <p className="text-pretty mt-3 text-sm text-neutral-600">
                {step.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
