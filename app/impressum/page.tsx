// src/app/impressum/page.tsx
import { Card } from "@/components/ui/card"

export default function ImpressumPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Impressum</h1>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Angaben gemäß § 5 DDG</h2>
            <div className="space-y-2 text-gray-600">
              <p>Maric Capital GmbH</p>
              <p>Karolinenstraße 13</p>
              <p>64342 Seeheim-Jugenheim</p>
              <p>Geschäftsführer: Petar Maric und Andre Maric</p>
              <p>E-Mail: kontakt@price-action-trader.de</p>
              {/* USt-IdNr. ergänzen, falls vorhanden (§ 5 Abs. 1 Nr. 6 DDG). */}
              <p>Handelsregister: Amtsgericht Darmstadt, HRB 107996</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Kontakt</h2>
            <div className="space-y-2 text-gray-600">
              <p>E-Mail: kontakt@price-action-trader.de</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Haftung für Inhalte</h2>
            <p className="text-gray-600">
              Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach Art. 8 der Verordnung (EU) 2022/2065 (Digital Services Act) sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Haftung für Links</h2>
            <p className="text-gray-600">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Verbraucherstreitbeilegung</h2>
            <p className="text-gray-600">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>
        </div>
      </Card>
    </div>
  )
}