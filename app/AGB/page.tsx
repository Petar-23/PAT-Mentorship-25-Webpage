// src/app/agb/page.tsx
import { Card } from "@/components/ui/card"

export default function AGBPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Allgemeine Geschäftsbedingungen</h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§1 Geltungsbereich</h2>
            <p className="text-gray-600 mb-4">
              Diese Allgemeinen Geschäftsbedingungen gelten für alle gegenwärtigen und zukünftigen
              Geschäftsbeziehungen zwischen PAT Mentorship (im Folgenden &quot;Anbieter&quot;) und dem Kunden (im
              Folgenden &quot;Teilnehmer&quot;).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§2 Vertragsgegenstand</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                2.1 Der Anbieter bietet ein Trading-Mentorship-Programm an, das aus verschiedenen
                Online-Schulungseinheiten besteht.
              </p>
              <p>
                2.2 Das Programm beginnt am 1. März 2025 und läuft für 12 Monate.
              </p>
              <p>
                2.3 Der genaue Leistungsumfang ergibt sich aus der Programmbeschreibung auf der Website.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§3 Vertragsschluss</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                3.1 Die Anmeldung erfolgt über die Website durch Abschluss eines Abonnements.
              </p>
              <p>
                3.2 Der Vertrag kommt durch die Bestätigung der Anmeldung durch den Anbieter zustande.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§4 Preise und Zahlungsbedingungen</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                4.1 Die Teilnahmegebühr beträgt 150€ pro Monat.
              </p>
              <p>
                4.2 Die Zahlung erfolgt monatlich im Voraus per Kreditkarte oder SEPA-Lastschrift.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§5 Kündigung</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                5.1 Das Abonnement kann jederzeit zum Ende des laufenden Monats gekündigt werden.
              </p>
              <p>
                5.2 Die Kündigung muss in Textform erfolgen.
              </p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§6 Haftung</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                6.1 Der Anbieter haftet nicht für den Trading-Erfolg der Teilnehmer.
              </p>
              <p>
                6.2 Trading birgt erhebliche Risiken und kann zum Totalverlust führen.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§7 Schlussbestimmungen</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                7.1 Es gilt das Recht der Bundesrepublik Deutschland.
              </p>
              <p>
                7.2 Sollten einzelne Bestimmungen unwirksam sein, bleibt der Rest wirksam.
              </p>
            </div>
          </section>
        </div>
      </Card>
    </div>
  )
}