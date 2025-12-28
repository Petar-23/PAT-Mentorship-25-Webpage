"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

const faqs = [
  {
    question: "Warum startet das Programm im März 2026?",
    answer: "Der Start im März 2026 ermöglicht es mir, alle Teilnehmer einzusammeln und sicherzustellen, dass alle gemeinsam beginnen, um von Tag eins an eine starke Community aufzubauen. Dies gibt dir auch die Zeit, deinen Platz zu sichern und dich auf das Programm vorzubereiten.",
    category: "Programmablauf"
  },
  {
    question: "Wie funktioniert das monatliche Abonnement?",
    answer: "Das Programm kostet 150€ pro Monat und du kannst jederzeit kündigen, wenn du nicht zufrieden bist. Dieses flexible Modell gewährleistet hochwertige Betreuung und ermöglicht es dir gleichzeitig, den Wert des Programms monatlich zu evaluieren.",
    category: "Preisgestaltung"
  },
  {
    question: "Was passiert, wenn ich mein Abonnement kündige?",
    answer: "Du behältst den Zugang bis zum Ende deiner bezahlten Periode. Falls du später wieder einsteigen möchtest, beachte, dass die Plätze begrenzt sind und möglicherweise nicht mehr verfügbar sind. Der Abschluss des gesamten Jahres gewährt dir dauerhaften Zugriff auf alle Materialien.",
    category: "Mitgliedschaft"
  },
  {
    question: "Welche Trading-Erfahrung benötige ich?",
    answer: "Ich kann mit Tradern aus allen Erfahrungsstufen arbeiten, wobei Grundkenntnisse der Marktprinzipien von Vorteil sind. Das Programm ist straf, aber es beginnt mit Grundkonzepten und bringt dich zu deinem Smart Money Modell.",
    category: "Voraussetzungen"
  },
  {
    question: "Welche Software benötige ich?",
    answer: "Ich arbeite mit TradingView und empfehle diese Software für die Mentorship. Grundsätzlich lassen sich die Konzepte aber auch mit jeder anderen Chart-Software erlernen, die über die nötigen Funktionen (Kerzen-Chart & Zeichentools) verfügt.",
    category: "Voraussetzungen"
  },
  {
    question: "Wie viel Zeit sollte ich wöchentlich einplanen?",
    answer: "Ich empfehle 5-10 Stunden pro Woche: 2-3 Stunden für Live-Sessions, 2-3 Stunden für Übungen und zusätzliche Zeit für Community-Interaktion. Alle Sessions werden aufgezeichnet und können flexibel angesehen werden.",
    category: "Zeitaufwand"
  },
  {
    question: "Kann ich auf frühere Session-Aufzeichnungen zugreifen?",
    answer: "Ja, alle Live-Sessions werden aufgezeichnet und sind auf unserer Plattform verfügbar. Dies stellt sicher, dass du keine wichtigen Inhalte verpasst, auch wenn du aufgrund von Zeitunterschieden nicht an Live-Sessions teilnehmen kannst.",
    category: "Zugriff auf Inhalte"
  },
  {
    question: "Was unterscheidet dies von aufgezeichneten Kursen?",
    answer: "Wir konzentrieren uns auf Live-Marktanalysen und Echtzeit-Handelsentscheidungen. Anders als bei statischen Kursen lernst du, dich an aktuelle Marktbedingungen anzupassen und entwickelst dynamische Trading-Fähigkeiten.",
    category: "Programmmerkmale"
  },
  {
    question: "Gibt es eine Rückerstattungspolitik?",
    answer: "Da wir mit einem monatlichen Abonnement-Modell arbeiten, gibt es keine langfristige Bindung. Du kannst jederzeit kündigen, wenn du das Gefühl hast, dass das Programm nicht deinen Erwartungen entspricht.",
    category: "Preisgestaltung"
  },
  {
    question: "Ist mein Erfolg garantiert?",
    answer: "Nein, wie viel du aus diesem Programm herausholen kannst, hängt von dir ab. Ich bringe dir das Traden bei; du musst es auch lernen wollen und die Arbeit reinstecken.",
    category: "Zeitaufwand"
  },
  {
    question: "Bekomme ich Einstiegs- und Ausstiegssignale für meine Trades?",
    answer: "Nein, die Live Tradings dienen nicht dem Copy-Trading. Du sollst unabhängig von mir handeln können.",
    category: "Programmmerkmale"
  },
  {
    question: "Welche Finanzinstrumente werden gehandelt?",
    answer: "Wir handeln primär Index-Futures (ES, NQ). Im Verlauf der Mentorship werden wir auch einen Blick auf Währungs-Futures und Rohstoffe werfen.",
    category: "Finanzinstrumente"
  },
  {
    question: "Funktionierne Smart Money Konzepte auch in Krypto und anderen Märkten?",
    answer: "Ja, Smart Money Konzepte sind universell anwendbar.",
    category: "Krypto"
  }
]

interface FAQItemProps {
  question: string
  answer: string
  category: string
  isOpen: boolean
  toggleOpen: () => void
}

function FAQItem({ question, answer, category, isOpen, toggleOpen }: FAQItemProps) {
  return (
    <div className="border-b border-gray-200 last:border-none">
      <button
        onClick={toggleOpen}
        className="py-6 w-full flex items-start justify-between text-left"
      >
        <div>
          <p className="text-sm font-medium text-blue-600 mb-2">{category}</p>
          <h3 className="font-medium text-gray-900">{question}</h3>
        </div>
        <div className="ml-4 flex-shrink-0">
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className={`h-5 w-5 ${isOpen ? 'text-blue-500' : 'text-gray-500'}`} />
          </motion.div>
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-gray-600">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-24 bg-slate-950">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-16">
          <p className="text-blue-400 font-semibold mb-4">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Häufig gestellte Fragen
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Alles, was du über das Mentoring-Programm wissen musst
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              category={faq.category}
              isOpen={openIndex === index}
              toggleOpen={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        
      </div>
    </section>
  )
}