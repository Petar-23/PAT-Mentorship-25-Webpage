// src/app/impressum/page.tsx
import { Card } from "@/components/ui/card"

export default function ImpressumPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Impressum</h1>
          
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Angaben gemäß § 5 TMG</h2>
            <div className="space-y-2">
              <p>Petar Maric</p>
              <p>Price Action Trader</p>
              <p>Erlenweg 16</p>
              <p>21423 Winsen</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Kontakt</h2>
            <div className="space-y-2">
              <p>E-Mail: kontakt@price-action-trader.de</p>
            </div>
          </section>

          {/* <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Handelsregister</h2>
            <div className="space-y-2">
              <p>Handelsregister: HRA XXXXX</p>
              <p>Registergericht: Amtsgericht München</p>
              <p>USt-IdNr: DE123456789</p>
            </div>
          </section> */}

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Streitbeilegung</h2>
            <p className="text-gray-600">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a 
                href="https://ec.europa.eu/consumers/odr/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p className="text-gray-600 mt-4">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Haftung für Inhalte</h2>
            <p className="text-gray-600">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
              zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>
        </div>
      </Card>
    </div>
  )
}