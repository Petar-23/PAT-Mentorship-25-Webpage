import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const benefits = [
  {
    title: 'Klarer Theorie‑Start',
    description:
      'Du bekommst die Grundlagen kompakt und verständlich, ohne Überforderung.',
  },
  {
    title: 'Klare Entscheidungsvorlage',
    description:
      'Die Checkliste und der Trading‑Plan geben dir eine klare Abfolge, bevor du auf „Trade“ klickst.',
  },
  {
    title: 'Strukturierter Fortschritt',
    description:
      'Du gehst Schritt für Schritt vor und überspringst keine Grundlagen.',
  },
]

const objections = [
  {
    title: 'Ist das nur ein weiterer Kurs?',
    answer:
      'Nein. Du bekommst klare Aufgaben, einen strukturierten Einstieg und eine saubere Reihenfolge.',
  },
  {
    title: 'Was, wenn ich noch Anfänger bin?',
    answer:
      'Genau dafür ist der Quick‑Start da: klare Schritte, keine Überforderung, schneller Einstieg.',
  },
  {
    title: 'Was, wenn ich neu bin?',
    answer:
      'Du startest mit den Grundlagen und arbeitest dich strukturiert vor.',
  },
]

export default function LeadMagnetBenefits() {
  return (
    <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-pretty text-sm font-medium text-emerald-700">
              Warum Diese 3 Videos Funktionieren
            </p>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-neutral-950 sm:text-4xl">
              Von Konzept Zu Handlung
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-700 sm:text-lg">
              Der größte Fehler ist es, zu schnell zu viel zu wollen und die
              Grundlagen zu überspringen. Du bekommst die wenigen Bausteine, die
              den Unterschied machen, und eine klare Reihenfolge, wie du sie nutzt.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <a href="#lead-magnet-form">
                  3‑Tage‑Plan & Checkliste Jetzt Sichern
                </a>
              </Button>
              <p className="text-pretty text-xs text-neutral-500">
                Die Inhalte kommen ausschließlich per E‑Mail.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {benefits.map(benefit => (
              <Card key={benefit.title} className="border-emerald-100 p-6">
                <h3 className="text-balance text-lg font-semibold text-neutral-950">
                  {benefit.title}
                </h3>
                <p className="text-pretty mt-2 text-sm text-neutral-600">
                  {benefit.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
        <div className="mt-14">
          <h2 className="text-balance text-2xl font-semibold text-neutral-950">
            Häufige Fragen
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {objections.map(item => (
              <Card key={item.title} className="p-6">
                <h3 className="text-balance text-base font-semibold text-neutral-950">
                  {item.title}
                </h3>
                <p className="text-pretty mt-2 text-sm text-neutral-600">
                  {item.answer}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
