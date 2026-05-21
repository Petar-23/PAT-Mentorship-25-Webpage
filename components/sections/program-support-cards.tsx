'use client'

import { ChartLine as LineChart } from "@phosphor-icons/react/ChartLine"
import { HeadCircuit as BrainCircuit } from "@phosphor-icons/react/HeadCircuit"
import { Users } from "@phosphor-icons/react/Users"
import { CardWithMatrix } from "@/components/ui/card-with-matrix"

const supportCards = [
  {
    icon: <Users className="h-full w-full" />,
    title: "Community Hub",
    description: "24/7 Zugang zu unserer privaten Discord-Community. Vernetze dich und wachse mit den anderen Mentees.",
    iconColor: "text-blue-400",
    rainColor: "#60A5FA",
    gradientColor: "rgba(96, 165, 250, 0.2)"
  },
  {
    icon: <LineChart className="h-full w-full" />,
    title: "Trading Indikatoren",
    description: "Speziell entwickelte Indikatoren für ICT Konzepte, die dir Zeit einsparen und manuelles einzeichnen von Leveln erleichtern.",
    iconColor: "text-purple-400",
    rainColor: "#A78BFA",
    gradientColor: "rgba(167, 139, 250, 0.2)"
  },
  {
    icon: <BrainCircuit className="h-full w-full" />,
    title: "Zugang zu Absolventen",
    description: "Vernetze dich mit Absolventen vorheriger PAT Mentorships, die dir ein paar Schritte voraus sind.",
    iconColor: "text-green-400",
    rainColor: "#34D399",
    gradientColor: "rgba(52, 211, 153, 0.2)"
  }
]

export function ProgramSupportCards() {
  return (
    <>
      {supportCards.map((feature, index) => (
        <CardWithMatrix
          key={index}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
          iconColor={feature.iconColor}
          rainColor={feature.rainColor}
          gradientColor={feature.gradientColor}
          className="h-auto sm:h-[250px] lg:h-auto"
        />
      ))}
    </>
  )
}
