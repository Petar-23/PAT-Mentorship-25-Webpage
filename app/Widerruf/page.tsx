import { Card } from "@/components/ui/card"

export default function WiderrufPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Widerrufsbelehrung</h1>
          <p className="text-gray-600 mb-8">der Maric Capital GmbH <br /> Stand: Januar 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Widerrufsrecht für Verbraucher</h2>
            <p className="text-gray-600 mb-4">
              Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
              Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Ausübung des Widerrufsrechts</h2>
            <p className="text-gray-600 mb-4">
              Um Ihr Widerrufsrecht auszuüben, müssen Sie uns mittels einer eindeutigen Erklärung (z. B. E-Mail oder Brief) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das untenstehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Kontakt für Widerruf</h2>
            <p className="text-gray-600 mb-4">
              An: Maric Capital GmbH, Karolinenstraße 13, 64342 Seeheim-Jugenheim, <a href="mailto:kontakt@price-action-trader.de" className="text-blue-600 underline hover:text-blue-700">E-Mail: kontakt@price-action-trader.de</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Folgen des Widerrufs</h2>
            <p className="text-gray-600 mb-4">
              Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen unverzüglich und spätestens binnen 14 Tagen ab Erhalt Ihrer Widerrufserklärung zurückzuzahlen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Vorzeitiges Erlöschen des Widerrufsrechts</h2>
            <p className="text-gray-600 mb-4">
              Bei allen monatlichen Mentoring-Programmen (Gruppen-Mentorship und privates 1:1-Mentoring) erlischt Ihr Widerrufsrecht vollständig und endgültig bereits mit Beginn der Leistungserbringung, wenn Sie vor Absenden Ihrer Bestellung ausdrücklich verlangt haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung der Dienstleistung beginnen, und gleichzeitig bestätigt haben, dass Ihnen bewusst ist, dass Sie Ihr Widerrufsrecht mit Beginn der Leistungserbringung vollständig verlieren. Siehe auch AGB § 7 für Details.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Muster-Widerrufsformular</h2>
            <p className="text-gray-600 mb-4 italic">
              (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)
            </p>
            <div className="space-y-4 text-gray-600">
              <p>An:</p>
              <div className="pl-4">
                <p>Maric Capital GmbH</p>
                <p>Karolinenstraße 13</p>
                <p>64342 Seeheim-Jugenheim</p>
                <p><a href="mailto:kontakt@price-action-trader.de" className="text-blue-600 underline hover:text-blue-700">E-Mail: kontakt@price-action-trader.de</a></p>
              </div>
              
              <p>
                Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)
              </p>
              
              <div className="pl-4 space-y-2">
                <p>- Bestellt am (*)/erhalten am (*)</p>
                <p>- Name des/der Verbraucher(s)</p>
                <p>- Anschrift des/der Verbraucher(s)</p>
                <p>- Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
                <p>- Datum</p>
              </div>
              
              <p className="text-sm italic">(*) Unzutreffendes streichen</p>
            </div>
          </section>
          
          <p className="text-gray-600 mt-8 pt-8 border-t border-gray-200">Maric Capital GmbH - Januar 2026</p>
        </div>
      </Card>
    </div>
  )
}