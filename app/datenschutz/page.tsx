// src/app/datenschutz/page.tsx
import { Card } from "@/components/ui/card"

export default function DatenschutzPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8">Datenschutzerklärung</h1>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">1. Datenschutz auf einen Blick</h2>
            
            <h3 className="text-lg font-medium mb-2">Allgemeine Hinweise</h3>
            <p className="text-gray-600 mb-4">
              Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten
              passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie
              persönlich identifiziert werden können.
            </p>

            <h3 className="text-lg font-medium mb-2">Datenerfassung auf dieser Website</h3>
            <p className="text-gray-600 mb-4">
              Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten
              können Sie dem Impressum dieser Website entnehmen.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">2. Hosting und Content Delivery Networks (CDN)</h2>
            <p className="text-gray-600 mb-4">
              Diese Website wird bei einem externen Dienstleister gehostet (Hoster). Die personenbezogenen Daten,
              die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">3. Allgemeine Hinweise und Pflichtinformationen</h2>
            
            <h3 className="text-lg font-medium mb-2">Datenschutz</h3>
            <p className="text-gray-600 mb-4">
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln
              Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften
              sowie dieser Datenschutzerklärung.
            </p>

            <h3 className="text-lg font-medium mb-2">Hinweis zur verantwortlichen Stelle</h3>
            <div className="text-gray-600 space-y-1">
              <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
              <p>Vorname Nachname</p>
              <p>PAT Mentorship</p>
              <p>Straße Nr.</p>
              <p>PLZ Stadt</p>
              <p>Telefon: +49 123 456789</p>
              <p>E-Mail: kontakt@example.com</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">4. Datenerfassung auf dieser Website</h2>
            
            <h3 className="text-lg font-medium mb-2">Cookies</h3>
            <p className="text-gray-600 mb-4">
              Unsere Internetseiten verwenden so genannte &quot;Cookies&quot;. Cookies sind kleine Textdateien und richten
              auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer
              Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">5. Plugins und Tools</h2>
            
            <h3 className="text-lg font-medium mb-2">Google Web Fonts</h3>
            <p className="text-gray-600 mb-4">
              Diese Seite nutzt zur einheitlichen Darstellung von Schriftarten so genannte Web Fonts. Die Google
              Fonts sind lokal installiert. Eine Verbindung zu Servern von Google findet dabei nicht statt.
            </p>
          </section>
        </div>
      </Card>
    </div>
  )
}