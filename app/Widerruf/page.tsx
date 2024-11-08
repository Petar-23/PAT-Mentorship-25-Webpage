// src/app/widerruf/page.tsx
import { Card } from "@/components/ui/card"

export default function WiderrufPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Widerrufsbelehrung</h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Widerrufsrecht</h2>
            <p className="text-gray-600 mb-4">
              Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
              Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
            </p>
            
            <p className="text-gray-600 mb-4">
              Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
            </p>
            
            <div className="text-gray-600 mb-4 pl-4">
              <p>PAT Mentorship</p>
              <p>Straße Nr.</p>
              <p>PLZ Stadt</p>
              <p>E-Mail: kontakt@example.com</p>
              <p>Telefon: +49 123 456789</p>
            </div>

            <p className="text-gray-600 mb-4">
              mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder E-Mail) über
              Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte
              Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
            </p>

            <p className="text-gray-600 mb-4">
              Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des
              Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Folgen des Widerrufs</h2>
            <p className="text-gray-600 mb-4">
              Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten
              haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus
              ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste
              Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag
              zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen
              ist.
            </p>

            <p className="text-gray-600 mb-4">
              Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen
              Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart;
              in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
            </p>

            <p className="text-gray-600 mb-4">
              Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen sollen, so haben
              Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie
              uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits
              erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen
              Dienstleistungen entspricht.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Muster-Widerrufsformular</h2>
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <p className="text-gray-600 mb-4 italic">
                (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden
                Sie es zurück.)
              </p>
              
              <div className="space-y-4 text-gray-600">
                <p>An:</p>
                <div className="pl-4">
                  <p>PAT Mentorship</p>
                  <p>Straße Nr.</p>
                  <p>PLZ Stadt</p>
                  <p>E-Mail: kontakt@example.com</p>
                </div>
                
                <p>
                  Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf
                  der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)
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
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Besondere Hinweise</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Das Widerrufsrecht erlischt bei einem Vertrag zur Erbringung von Dienstleistungen auch dann,
                wenn der Unternehmer die Dienstleistung vollständig erbracht hat und mit der Ausführung der
                Dienstleistung erst begonnen hat, nachdem der Verbraucher dazu seine ausdrückliche Zustimmung
                gegeben hat und gleichzeitig seine Kenntnis davon bestätigt hat, dass er sein Widerrufsrecht
                bei vollständiger Vertragserfüllung durch den Unternehmer verliert.
              </p>
            </div>
          </section>
        </div>
      </Card>
    </div>
  )
}