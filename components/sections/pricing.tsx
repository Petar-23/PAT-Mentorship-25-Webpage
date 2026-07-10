import { MENTORSHIP_CONFIG, MENTORSHIP_IS_UPCOMING } from '@/lib/config'
import { Check } from "@phosphor-icons/react/dist/ssr/Check"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MentorshipEntryCta } from '@/components/sections/mentorship-entry-cta'

const features = [
  "2 Live-Sessions pro Woche (Di + Do)",
  "Wöchentlicher Marktausblick mit Draw on Liquidity",
  "Tagesausblick am Dienstag und Donnerstag",
  "3-4 vollständige Trading-Modelle mit Trading Plan",
  "Alle Recordings verfügbar solange du dabei bist",
  "Fokussierte Community für Austausch und Feedback",
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 md:px-6 bg-gray-50">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Faire Preise, faires Risiko
          </h2>
          <p className="text-lg text-gray-600">
            Kein Upfront-Betrag. Kein Lock-in. Jeden Monat kündbar.
          </p>
        </div>

        <Card className="relative border-2">
          
          <div className="absolute top-0 right-0 mr-6 -mt-4">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
              {MENTORSHIP_IS_UPCOMING ? 'Warteliste geöffnet' : 'Laufender Jahrgang'}
            </span>
          </div>
          
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">PAT Mentorship</CardTitle>
            <div className="mt-6">
              <span className="text-5xl font-bold">{MENTORSHIP_CONFIG.priceFormatted}</span>
              <span className="text-gray-600 text-lg">/Monat</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">monatlich kündbar</p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            
            <div className="bg-blue-50/50 border-l-4 border-blue-500 p-6 rounded-r-lg">
              <p className="text-gray-700 leading-relaxed italic">
                Kein 3.000€ Kurs den du im Voraus bezahlst und danach bist du auf dich alleine gestellt. 
                Du zahlst monatlich — wenn ich als Mentor nicht liefere, kannst du zum Monatsende gehen.
                Das Risiko liegt bei mir.
              </p>
            </div>

            <ul className="space-y-4 pt-4">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="pt-4">
              <MentorshipEntryCta
                source="pricing_cta"
                className="w-full"
              />
              <p className="mt-3 text-center text-sm leading-relaxed text-gray-500">
                Kostenlos anmelden → Konditionen prüfen → sicher über Stripe buchen
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
