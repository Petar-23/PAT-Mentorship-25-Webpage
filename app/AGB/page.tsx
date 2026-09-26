import { Card } from "@/components/ui/card"
import { LegalBlockView } from "@/components/legal/legal-blocks"
import { AGB } from "@/lib/legal-texts"

// Wortlaut steht in lib/legal-texts.ts (gemeinsame Quelle für diese Seite und die Vertragsbestätigung per E-Mail).

export default function AGBPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card className="max-w-3xl mx-auto bg-white">
        <div className="p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-8 break-words hyphens-auto">{AGB.title}</h1>
          <p className="text-gray-600 mb-8">{AGB.company} <br /> Stand: {AGB.stand}</p>

          {AGB.sections.map((section) => (
            <section key={section.heading} className="mb-8">
              <h2 className="text-xl font-semibold mb-4">{section.heading}</h2>
              {section.blocks.map((block, index) => (
                <LegalBlockView key={index} block={block} />
              ))}
            </section>
          ))}

          <p className="text-gray-600">{AGB.closing}</p>
        </div>
      </Card>
    </div>
  )
}
