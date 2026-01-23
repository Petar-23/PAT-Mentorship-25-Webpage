"use client"

import { motion } from "framer-motion"
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
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      },
    },
  }

  const wordAnimation = {
    hidden: {
      opacity: 0,
      filter: "blur(10px)",
    },
    show: {
      opacity: 1,
      filter: "blur(0px)",
    },
  }

  const words = text.split(" ")

  return (
    <div className="w-full">
      <motion.p
        variants={container}
        initial="hidden"
        animate="show"
        className="text-base leading-relaxed text-neutral-700"
      >
        {words.map((word, index) => (
          <motion.span
            key={index}
            variants={wordAnimation}
            transition={{ duration: 0.3 }}
            className="inline-block mr-[0.25em]"
          >
            {word}
          </motion.span>
        ))}
      </motion.p>
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
