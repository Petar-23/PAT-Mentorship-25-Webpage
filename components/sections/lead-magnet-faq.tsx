import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const faqs = [
  {
    id: "item-1",
    question: "Ist das nur ein weiterer Kurs?",
    answer: "Nein. Du bekommst klare Aufgaben, einen strukturierten Einstieg und eine saubere Reihenfolge.",
  },
  {
    id: "item-2",
    question: "Was, wenn ich noch Anfänger bin?",
    answer: "Genau dafür ist der Quick‑Start da: klare Schritte, keine Überforderung, schneller Einstieg.",
  },
  {
    id: "item-3",
    question: "Was, wenn ich neu bin?",
    answer: "Du startest mit den Grundlagen und arbeitest dich strukturiert vor.",
  },
]

const BlurredStagger = ({ text }: { text: string }) => {
  return (
    <div className="w-full">
      <p className="text-base leading-relaxed text-neutral-700">{text}</p>
    </div>
  )
}

export default function LeadMagnetFAQ() {
  return (
    <section className="px-5 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="text-neutral-950 text-3xl md:text-4xl font-bold">
              Häufige Fragen
            </h2>
            <p className="text-neutral-600 mt-4 text-balance text-lg">
              Alles, was du über den Quick-Start wissen musst
            </p>
          </div>

          <div>
            <Accordion type="single" collapsible defaultValue="item-1">
              {faqs.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b border-neutral-200"
                >
                  <AccordionTrigger className="cursor-pointer text-base font-medium text-neutral-900 hover:no-underline py-4 text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <BlurredStagger text={item.answer} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  )
}
