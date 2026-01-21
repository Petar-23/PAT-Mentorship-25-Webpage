import { Button } from '@/components/ui/button'
import { HeroPill } from '@/components/ui/hero-pill'

const benefits = [
  {
    title: 'Klarer Theorie‑Start',
    description:
      'Du bekommst die Grundlagen kompakt und verständlich, ohne Überforderung.',
  },
  {
    title: 'Klare Entscheidungsvorlage',
    description:
      'Die Checkliste und der Trading‑Plan geben dir eine klare Abfolge, bevor du auf „Trade" klickst.',
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
    <section className="px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="w-fit">
              <HeroPill 
                variant="dark"
                announcement="✨" 
                label="Warum Diese 3 Videos Funktionieren" 
              />
            </div>
            <h2 className="text-balance mt-4 text-3xl font-semibold text-white sm:text-4xl">
              Von Konzept Zu Handlung
            </h2>
            <p className="text-pretty mt-4 text-base text-neutral-300 sm:text-lg">
              Der größte Fehler ist es, zu schnell zu viel zu wollen und die
              Grundlagen zu überspringen. Du bekommst die wenigen Bausteine, die
              den Unterschied machen, und eine klare Reihenfolge, wie du sie nutzt.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <a href="#lead-magnet-form">
                  Modell 22 Checkliste Jetzt Sichern
                </a>
              </Button>
              <p className="text-pretty text-xs text-neutral-400">
                Die Inhalte kommen ausschließlich per E‑Mail.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {benefits.map(benefit => (
              <div 
                key={benefit.title} 
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <h3 className="text-balance text-lg font-semibold text-white">
                  {benefit.title}
                </h3>
                <p className="text-pretty mt-2 text-sm text-neutral-300">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14">
          <h2 className="text-balance text-2xl font-semibold text-white">
            Häufige Fragen
          </h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {objections.map(item => (
              <div 
                key={item.title} 
                className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <h3 className="text-balance text-base font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-pretty mt-2 text-sm text-neutral-300">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
