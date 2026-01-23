"use client"

import { motion } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

const faqs = [
  {
    id: "item-1",
    question: "Warum startet das Programm im März 2026?",
    answer: "Der Start am 01.03.2026 ermöglicht es mir, alle Teilnehmer einzusammeln und sicherzustellen, dass alle gemeinsam beginnen, um von Tag eins an eine starke Community aufzubauen. Dies gibt dir auch die Zeit, deinen Platz zu sichern und dich auf das Programm vorzubereiten.",
  },
  {
    id: "item-2",
    question: "Wie funktioniert das monatliche Abonnement?",
    answer: "Das Programm kostet 150€ pro Monat (inkl. MwSt.) und du kannst jederzeit kündigen, wenn du nicht zufrieden bist. Dieses flexible Modell gewährleistet hochwertige Betreuung und ermöglicht es dir gleichzeitig, den Wert des Programms monatlich zu evaluieren.",
  },
  {
    id: "item-3",
    question: "Wie laufen die Q&A Sessions ab?",
    answer: "Am Ende jedes Monats gibt es eine Q&A Live-Session als Livestream. Du kannst dort alle deine Fragen stellen und ich nehme mir so viel Zeit wie möglich, um sie im Detail zu beantworten. Natürlich sind auch diese Sessions aufgezeichnet.",
  },
  {
    id: "item-4",
    question: "Wann finden die Live Calls statt und was ist der Wochenplan?",
    answer: "Die wöchentlichen Live Calls sind Dienstag um 15:00 Uhr und Donnerstag um 19:00 Uhr. Am Sonntag gibt es ein aufgezeichnetes Video zur Wochenvorbereitung. Zusätzlich gibt es am Dienstag und Donnerstag ein Daily Review (voraufgezeichnet), das jeweils vor 15:30 Uhr veröffentlicht wird. Alles ist als Aufzeichnung verfügbar, falls du live nicht kannst.",
  },
  {
    id: "item-5",
    question: "Was passiert, wenn ich mein Abonnement kündige?",
    answer: "Du behältst den Zugang bis zum Ende deiner bezahlten Periode. Falls du später wieder einsteigen möchtest, beachte, dass die Plätze begrenzt sind und möglicherweise nicht mehr verfügbar sind. Der Abschluss des gesamten Jahres gewährt dir dauerhaften Zugriff auf alle Materialien.",
  },
  {
    id: "item-6",
    question: "Welche Trading-Erfahrung benötige ich?",
    answer: "Ich kann mit Tradern aus allen Erfahrungsstufen arbeiten, wobei Grundkenntnisse der Marktprinzipien von Vorteil sind. Das Programm ist straf, aber es beginnt mit Grundkonzepten und bringt dich zu deinem Smart Money Modell.",
  },
  {
    id: "item-7",
    question: "Welche Software benötige ich?",
    answer: "Ich arbeite mit TradingView und empfehle diese Software für die Mentorship. Grundsätzlich lassen sich die Konzepte aber auch mit jeder anderen Chart-Software erlernen, die über die nötigen Funktionen (Kerzen-Chart & Zeichentools) verfügt.",
  },
  {
    id: "item-8",
    question: "Wie viel Zeit sollte ich wöchentlich einplanen?",
    answer: "Ich empfehle 5-10 Stunden pro Woche: 2-3 Stunden für Live-Sessions, 2-3 Stunden für Übungen und zusätzliche Zeit für Community-Interaktion. Alle Sessions werden aufgezeichnet und können flexibel angesehen werden.",
  },
  {
    id: "item-9",
    question: "Kann ich auf frühere Session-Aufzeichnungen zugreifen?",
    answer: "Ja, alle Live-Sessions werden aufgezeichnet und sind auf unserer Plattform verfügbar. Dies stellt sicher, dass du keine wichtigen Inhalte verpasst, auch wenn du aufgrund von Zeitunterschieden nicht an Live-Sessions teilnehmen kannst.",
  },
  {
    id: "item-10",
    question: "Was unterscheidet dies von aufgezeichneten Kursen?",
    answer: "Wir konzentrieren uns auf Live-Marktanalysen und Echtzeit-Handelsentscheidungen. Anders als bei statischen Kursen lernst du, dich an aktuelle Marktbedingungen anzupassen und entwickelst dynamische Trading-Fähigkeiten.",
  },
  {
    id: "item-11",
    question: "Gibt es eine Rückerstattungspolitik?",
    answer: "Da wir mit einem monatlichen Abonnement-Modell arbeiten, gibt es keine langfristige Bindung. Du kannst jederzeit kündigen, wenn du das Gefühl hast, dass das Programm nicht deinen Erwartungen entspricht.",
  },
  {
    id: "item-12",
    question: "Ist mein Erfolg garantiert?",
    answer: "Nein, wie viel du aus diesem Programm herausholen kannst, hängt von dir ab. Ich bringe dir das Traden bei; du musst es auch lernen wollen und die Arbeit reinstecken.",
  },
  {
    id: "item-13",
    question: "Bekomme ich Einstiegs- und Ausstiegssignale für meine Trades?",
    answer: "Nein, die Live Tradings dienen nicht dem Copy-Trading. Du sollst unabhängig von mir handeln können.",
  },
  {
    id: "item-14",
    question: "Welche Finanzinstrumente werden gehandelt?",
    answer: "Wir handeln primär Index-Futures (ES, NQ). Im Verlauf der Mentorship werden wir auch einen Blick auf Währungs-Futures und Rohstoffe werfen.",
  },
  {
    id: "item-15",
    question: "Funktionieren Smart Money Konzepte auch in Krypto und anderen Märkten?",
    answer: "Ja, Smart Money Konzepte sind universell anwendbar.",
  }
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

  // Teile in Wörter auf, um korrekten Umbruch zu gewährleisten
  const words = text.split(" ")

  return (
    <div className="w-full">
      <motion.p
        variants={container}
        initial="hidden"
        animate="show"
        className="text-sm sm:text-base leading-relaxed text-gray-600"
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

export default function FAQ() {
  return (
    <section className="py-12 md:py-24 bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-5 md:gap-12">
          <div className="md:col-span-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-blue-50 ring-1 ring-blue-200 mb-3 sm:mb-4">
              <div className="bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 text-xs sm:text-sm">❓</div>
              <span className="text-xs sm:text-sm font-medium text-blue-700">FAQ</span>
            </div>
            <h2 className="text-gray-900 text-2xl sm:text-3xl md:text-4xl font-bold">
              Häufig gestellte Fragen
            </h2>
            <p className="text-gray-600 mt-2 sm:mt-4 text-balance text-sm sm:text-lg">
              Alles, was du über das Mentoring-Programm wissen musst
            </p>
          </div>

          <div className="md:col-span-3">
            <Accordion type="single" collapsible defaultValue="item-1">
              {faqs.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b border-gray-200"
                >
                  <AccordionTrigger className="cursor-pointer text-sm sm:text-base font-medium text-gray-900 hover:no-underline py-3 sm:py-4 text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 sm:pb-4">
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