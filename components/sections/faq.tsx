// src/components/sections/faq.tsx
"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

const faqs = [
  {
    question: "Why does the program start in March 2025?",
    answer: "The March 2025 start date allows us to properly prepare and ensure all mentees start together, creating a strong community from day one. This also gives you time to secure your spot and prepare for the program.",
    category: "Program Schedule"
  },
  {
    question: "How does the monthly subscription work?",
    answer: "The program costs €150 per month, and you can cancel anytime if you're not satisfied. This flexible model ensures we maintain high-quality mentorship while allowing you to evaluate the program's value monthly.",
    category: "Pricing"
  },
  {
    question: "What happens if I cancel my subscription?",
    answer: "You maintain access until the end of your paid period. If you decide to rejoin, note that spots are limited and may not be available. Completing the full year grants lifetime access to all materials.",
    category: "Membership"
  },
  {
    question: "What trading experience do I need?",
    answer: "While we welcome traders of all levels, basic understanding of market fundamentals is beneficial. Our program adapts to your experience level, starting with core concepts and progressing to advanced strategies.",
    category: "Requirements"
  },
  {
    question: "How much time should I commit weekly?",
    answer: "We recommend 5-10 hours weekly: 2-3 hours for live sessions, 2-3 hours for practice, and additional time for community interaction. All sessions are recorded for flexible viewing.",
    category: "Commitment"
  },
  {
    question: "Can I access previous session recordings?",
    answer: "Yes, all live sessions are recorded and available in our platform. This ensures you never miss crucial content, even if you can't attend live sessions due to time zone differences.",
    category: "Content Access"
  },
  {
    question: "What makes this different from pre-recorded courses?",
    answer: "We focus on live market analysis and real-time trading decisions. Unlike static courses, you'll learn how to adapt to current market conditions and develop dynamic trading skills.",
    category: "Program Features"
  },
  {
    question: "Is there a refund policy?",
    answer: "Since we operate on a monthly subscription model, there's no long-term commitment. You can cancel anytime if you feel the program isn't meeting your expectations.",
    category: "Pricing"
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
            Common Questions
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Everything you need to know about the mentorship program
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

        <div className="mt-12 text-center">
          <p className="text-gray-400">
            Still have questions?{' '}
            <a href="#contact" className="text-blue-400 hover:text-blue-300">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}