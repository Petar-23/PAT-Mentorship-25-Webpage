import { Card } from "@/components/ui/card"

export default function DatenschutzPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Datenschutzerklärung</h1>
          <p className="text-gray-600 mb-8">der Maric Capital GmbH <br /> Stand: Januar 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Verantwortlicher und Kontaktdaten</h2>
            <p className="text-gray-600 mb-4">
              Verantwortlicher im Sinne der DSGVO ist:
            </p>
            <div className="pl-4 space-y-1 text-gray-600">
              <p>Maric Capital GmbH</p>
              <p>Karolinenstraße 13</p>
              <p>64342 Seeheim-Jugenheim</p>
              <p>Deutschland</p>
              <p>Geschäftsführer: Petar Maric und Andre Maric</p>
              <p>E-Mail: kontakt@price-action-trader.de</p>
              <p>Handelsregister: Amtsgericht Darmstadt</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Zweck und Rechtsgrundlage der Datenverarbeitung</h2>
            <p className="text-gray-600 mb-4">
              Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung unserer Website, des Mentoring-Programms und der Zahlungsabwicklung erforderlich ist.
            </p>
            <p className="text-gray-600 mb-4">
              Rechtsgrundlagen sind insbesondere:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung und vorvertragliche Maßnahmen)</li>
              <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen, z. B. Betrieb der Website, Sicherheit, Marketing)</li>
              <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, z. B. bei Newsletter)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Beim Besuch der Website</h2>
            <p className="text-gray-600 mb-4">
              Beim rein informatorischen Besuch unserer Website erheben wir nur die Daten, die Ihr Browser an unseren Server übermittelt (Server-Logfiles):
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-600">
              <li>IP-Adresse (anonymisiert nach 7 Tagen)</li>
              <li>Datum und Uhrzeit der Anfrage</li>
              <li>Zeitzonendifferenz zur GMT</li>
              <li>Inhalt der Anforderung</li>
              <li>Zugriffsstatus/HTTP-Statuscode</li>
              <li>jeweils übertragene Datenmenge</li>
              <li>Website, von der die Anforderung kommt</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Hosting und Content Delivery Networks (CDN)</h2>
            <p className="text-gray-600 mb-4">
              Diese Website wird bei Vercel (EU-Edge-Caching, USA-Transfer mit SCCs) gehostet. Bunny.net CDN für Videos (EU-Server). Verarbeitung Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse an Sicherheit/Beschleunigung).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Allgemeine Hinweise und Pflichtinformationen</h2>
            
            <h3 className="text-lg font-medium mb-2">Datenschutz</h3>
            <p className="text-gray-600 mb-4">
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
            </p>

            <h3 className="text-lg font-medium mb-2">Hinweis zur verantwortlichen Stelle</h3>
            <div className="space-y-1 text-gray-600">
              <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
              <p>Maric Capital GmbH</p>
              <p>Karolinenstraße 13</p>
              <p>64342 Seeheim-Jugenheim</p>
              <p>E-Mail: kontakt@price-action-trader.de</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">6. Datenerfassung auf dieser Website</h2>
            
            <h3 className="text-lg font-medium mb-2">Cookies</h3>
            <p className="text-gray-600 mb-4">
              Unsere Internetseiten verwenden so genannte „Cookies“. Cookies sind kleine Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">7. Plugins und Tools</h2>
            
            <h3 className="text-lg font-medium mb-2">Google Web Fonts</h3>
            <p className="text-gray-600 mb-4">
              Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten so genannte Web Fonts. Die Google Fonts sind lokal installiert. Eine Verbindung zu Servern von Google findet dabei nicht statt.
            </p>

            <h3 className="text-lg font-medium mb-2">Verwendung von Clerk</h3>
            <p className="text-gray-600 mb-4">
              Wir verwenden den Dienst „Clerk“, um die Verwaltung von Benutzerkonten und die Authentifizierung auf unserer Website zu ermöglichen. Clerk erhebt und verarbeitet personenbezogene Daten wie Namen, E-Mail-Adressen und Authentifizierungsinformationen. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Erfüllung eines Vertrags) oder Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer sicheren und effizienten Benutzerverwaltung).
            </p>

            <h3 className="text-lg font-medium mb-2">Verwendung von Stripe</h3>
            <p className="text-gray-600 mb-4">
              Für die Abwicklung von Zahlungen verwenden wir den Dienst „Stripe“. Stripe verarbeitet Zahlungsdaten wie Kreditkarteninformationen, Transaktionsbeträge und andere Zahlungsdetails. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Erfüllung eines Vertrags).
            </p>
            <p className="text-gray-600 mb-4">
              Stripe wird von der Stripe Inc. betrieben. Weitere Informationen zum Datenschutz bei Stripe finden Sie in der <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Datenschutzerklärung von Stripe</a>.
            </p>
            <p className="text-gray-600 mb-4">
              Stripe kann Daten außerhalb der EU verarbeiten, insbesondere in den USA. Stripe gewährleistet in diesen Fällen den Schutz der Daten durch Standardvertragsklauseln (SCCs) gemäß Art. 46 DSGVO.
            </p>

            <h3 className="text-lg font-medium mb-2">Verwendung von Discord</h3>
            <p className="text-gray-600 mb-4">
              Zur Community-Kommunikation nutzen wir Discord. Discord erhebt Namen, E-Mail, Discord-ID und Rollen. Verarbeitung nach Art. 6 Abs. 1 lit. b/f DSGVO (Vertrag/Interesse). 
              <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Datenschutzerklärung Discord</a>.
              Transfer USA via SCCs.
            </p>

            <h3 className="text-lg font-medium mb-2">Video-Hosting via Bunny.net</h3>
            <p className="text-gray-600 mb-4">
              Videos werden auf Bunny.net (EU-Server) gehostet. Logs/IPs für 30 Tage. Art. 6 Abs. 1 lit. f DSGVO.
              <a href="https://bunny.net/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Privacy Bunny</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">8. Ihre Rechte</h2>
            <p className="text-gray-600 mb-4">
              Sie haben das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Hierzu sowie zu weiteren Fragen zum Thema Datenschutz können Sie sich jederzeit unter der im Impressum angegebenen Adresse an uns wenden.
            </p>
          </section>

          <p className="text-gray-600">Maric Capital GmbH - Januar 2026</p>
        </div>
      </Card>
    </div>
  )
}