import { Card } from "@/components/ui/card"
import { LegalAnchor, LegalBlockView } from "@/components/legal/legal-blocks"
import { WIDERRUFSBELEHRUNG } from "@/lib/legal-texts"

// Wortlaut steht in lib/legal-texts.ts (gemeinsame Quelle für diese Seite und die Vertragsbestätigung per E-Mail).

export default function WiderrufPage() {
  const { form } = WIDERRUFSBELEHRUNG

  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8 break-words hyphens-auto">{WIDERRUFSBELEHRUNG.title}</h1>
          <p className="text-gray-600 mb-8">{WIDERRUFSBELEHRUNG.company} <br /> Stand: {WIDERRUFSBELEHRUNG.stand}</p>

          {WIDERRUFSBELEHRUNG.sections.map((section) => (
            <section key={section.heading} className="mb-8">
              <h2 className="text-xl font-semibold mb-4">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <LegalBlockView key={index} block={block} />
              ))}
            </section>
          ))}

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{form.heading}</h2>
            <p className="text-gray-600 mb-4 italic">
              {form.hint}
            </p>
            <div className="space-y-4 text-gray-600">
              <p>{form.recipientLabel}</p>
              <div className="pl-4">
                {form.recipientLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p><LegalAnchor link={form.recipientEmail} /></p>
              </div>

              <p>
                {form.statement}
              </p>

              <div className="pl-4 space-y-2">
                {form.fields.map((field) => (
                  <p key={field}>- {field}</p>
                ))}
              </div>

              <p className="text-sm italic">{form.footnote}</p>
            </div>
          </section>

          <p className="text-gray-600 mt-8 pt-8 border-t border-gray-200">{WIDERRUFSBELEHRUNG.closing}</p>
        </div>
      </Card>
    </div>
  )
}
