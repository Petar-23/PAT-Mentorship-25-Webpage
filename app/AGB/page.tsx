import { Card } from "@/components/ui/card"

export default function AGBPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-gray-600 mb-8">der Maric Capital GmbH <br /> Stand: Januar 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 1 Geltungsbereich</h2>
            <p className="text-gray-600 mb-4">
              Diese AGB gelten für alle Verträge zwischen Maric Capital GmbH, Karolinenstraße 13, 64342 Seeheim-Jugenheim, Geschäftsführer: Petar Maric und Andre Maric | E-Mail: kontakt@price-action-trader.de (nachfolgend „Anbieter“) und dem Kunden über monatliche Mentoring-Programme (Gruppe oder 1:1) sowie Event-Tickets.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 2 Vertragsgegenstand</h2>
            <p className="text-gray-600 mb-4">
              Der Anbieter erbringt ausschließlich edukative Leistungen zur Vermittlung von Trading-Wissen. Keine Anlageberatung i.S.d. KWG/WpHG. Die Haupt-Mentorship läuft über die eigene Plattform. Der Anbieter behält sich vor, Event-Tickets, 1:1-Coachings oder Video-Zugänge teilweise über Whop abzuwickeln. Aufzeichnungen werden auf die Mentorship-Plattform hochgeladen, um sie den Kunden verfügbar zu machen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 3 Vertragsschluss und Preisangabe</h2>
            <ol className="list-decimal pl-6 space-y-2 text-gray-600">
              <li>Der Vertrag kommt über Zahlungs- oder Buchungsfunktionen auf der Website des Anbieters (z. B. Stripe-Checkout), über Whop (für Events/1:1) oder durch Annahme einer individuellen Rechnung zustande.</li>
              <li>Die auf der Website angezeigten Preise sind Endpreise inklusive jeweils gültiger gesetzlicher Umsatzsteuer (MwSt.). Der Gesamtpreis (brutto) wird bei der Bestellung transparent ausgewiesen und vor Abschluss nochmals deutlich angezeigt.</li>
              <li>Mit Abschluss der Bestellung (z. B. Checkout oder Whop) erklärt sich der Kunde mit dem ausgewiesenen Gesamtpreis einverstanden.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 4 Zahlungsbedingungen</h2>
            <p className="text-gray-600 mb-4">
              Zahlung erfolgt direkt über Stripe (Kreditkarte oder SEPA) oder Whop (für Events/1:1-Coachings). Bei individuellen 1:1-Mentorings kann auch per Rechnung mit Banküberweisung gezahlt werden.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 5 Laufzeit und Kündigung – monatliche Mentorings</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>keine Mindestlaufzeit</li>
              <li>verlängert sich automatisch um je einen Monat</li>
              <li>jederzeit kündbar mit Frist von 1 Tag zum Monatsende</li>
              <li>Kündigung über den „Mitgliedschaft verwalten“-Button auf der Plattform (führt zum Stripe-Customer-Portal), die Stripe-Customer-Portal-Funktion oder per E-Mail an kontakt@price-action-trader.de</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 6 Laufzeit - Event-Tickets</h2>
            <p className="text-gray-600 mb-4">
              Einmalzahlung, keine Verlängerung, keine Kündigung erforderlich.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 7 Widerrufsrecht und vorzeitiges Erlöschen</h2>
            <ol className="list-decimal pl-6 space-y-2 text-gray-600">
              <li>Verbraucher haben ein 14-tägiges Widerrufsrecht (§§ 355 ff. BGB). Die detaillierte Widerrufsbelehrung ist vor Vertragsschluss auf <a href="https://price-action-trader.de/widerruf" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">price-action-trader.de/widerruf</a> abrufbar und wird per E-Mail nach Kauf zugesandt.</li>
              <li>Vorzeitiges Erlöschen des Widerrufsrechts: Durch Akzeptanz dieser AGB und Abschluss des Checkouts erklären Sie sich ausdrücklich damit einverstanden, dass vor Ablauf der Widerrufsfrist mit der Erbringung der Dienstleistung begonnen wird (sofortiger Zugang zu allen Inhalten, Live-Calls, der Community und dem Mitgliederbereich). Ihnen ist bekannt und Sie bestätigen, dass Sie durch diese ausdrückliche Forderung Ihr Widerrufsrecht bereits mit Beginn der Leistungserbringung vollständig und unwiderruflich verlieren (§ 356 Abs. 5 BGB). Der Anbieter gewährt den vollständigen Zugang unmittelbar nach Zahlungseingang, womit das Widerrufsrecht erlischt. Bei Event-Tickets erlischt es spätestens mit Beginn der Veranstaltung.</li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 8 Stornierung von Live-Events</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>&gt;60 Tage vorher: volle Rückerstattung minus 50 € Bearbeitung</li>
              <li>60-30 Tage vorher: 50 % Rückerstattung</li>
              <li>&lt; 30 Tage vorher / No-Show: keine Rückerstattung</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 9 Haftung und Risikohinweise</h2>
            <p className="text-gray-600 mb-4">
              Keine Erfolgs- oder Gewinngarantie. Trading kann zum Totalverlust führen. Haftung für leicht fahrlässige Pflichtverletzungen ausgeschlossen (außer bei Verletzung wesentlicher Vertragspflichten).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 10 Urheberrechte</h2>
            <p className="text-gray-600 mb-4">
              Alle Inhalte urheberrechtlich geschützt. Weitergabe und Aufzeichnung verboten.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 11 Datenschutz</h2>
            <p className="text-gray-600 mb-4">
              Die Verarbeitung personenbezogener Daten erfolgt nach Maßgabe der Datenschutzerklärung, abrufbar unter <a href="https://price-action-trader.de/datenschutz" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">price-action-trader.de/datenschutz</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">§ 12 Schlussbestimmungen</h2>
            <p className="text-gray-600 mb-4">
              Deutsches Recht | Gerichtsstand für Kaufleute: Sitz des Anbieters | OS-Plattform: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">https://ec.europa.eu/consumers/odr/</a> | Salvatorische Klausel.
            </p>
          </section>

          <p className="text-gray-600">Maric Capital GmbH - Januar 2026</p>
        </div>
      </Card>
    </div>
  )
}