// src/components/sections/program-structure.tsx
import { CheckCircle, Users, BrainCircuit, LineChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { GradientCard } from '@/components/ui/gradient-card'

interface ProgramPhase {
phase: string;
description: string;
features: string[];
duration: string;
}

const programPhases: ProgramPhase[] = [
{
phase: "Phase 1: Foundation",
description: "Master the basics of price action trading",
features: [
 "Live market analysis sessions",
 "Core price action patterns",
 "Risk management fundamentals",
 "Market psychology basics"
],
duration: "Months 1-3"
},
{
phase: "Phase 2: Advanced Concepts",
description: "Deepen your understanding with real-time analysis",
features: [
 "Advanced pattern recognition",
 "Multiple timeframe analysis",
 "Trade journaling methods",
 "Position sizing strategies"
],
duration: "Months 4-6"
},
{
phase: "Phase 3: Live Trading",
description: "Apply your knowledge in real market conditions",
features: [
 "Live trading sessions",
 "Trade review workshops",
 "Advanced risk management",
 "Portfolio building strategies"
],
duration: "Months 7-9"
},
{
phase: "Phase 4: Mastery",
description: "Refine your edge and build lasting success",
features: [
 "Advanced trading psychology",
 "Market adaptability training",
 "Personal strategy development",
 "Long-term success planning"
],
duration: "Months 10-12"
}
];

interface WeeklySession {
day: string;
time: string;
type: string;
description: string;
}

const weeklySchedule: WeeklySession[] = [
{
day: "Tuesday",
time: "19:00 CET",
type: "Live Market Analysis",
description: "Deep dive into current market conditions and setups"
},
{
day: "Thursday",
time: "19:00 CET",
type: "Strategy & Education",
description: "Focused learning sessions and pattern recognition"
},
{
day: "Sunday",
time: "16:00 CET",
type: "Week Preparation",
description: "Market review and week ahead planning"
}
];

type ColorVariant = 'blue' | 'purple' | 'green' | 'orange' | 'red';

interface SupportFeature {
title: string;
description: string;
icon: JSX.Element;
className: string;
color: ColorVariant;
}

const colorVariants: Record<ColorVariant, string> = {
blue: "bg-blue-50 text-blue-600",
purple: "bg-purple-50 text-purple-600",
green: "bg-green-50 text-green-600",
orange: "bg-orange-50 text-orange-600",
red: "bg-red-50 text-red-600"
};

const supportFeatures: SupportFeature[] = [
    {
      title: "Community Hub",
      description: "24/7 access to our private Discord community. Connect, learn, and grow with fellow traders",
      icon: <Users className="h-6 w-6" />,
      className: "lg:col-span-1",
      color: "blue"
    },
    {
      title: "Trading Indicators",
      description: "Custom-developed indicators specifically for ICT Concepts, helping you identify key market levels and patterns",
      icon: <LineChart className="h-6 w-6" />,
      className: "lg:col-span-1",
      color: "purple"
    },
    {
      title: "Strategy Development",
      description: "Build and refine your personal trading strategy based on ICT Concepts",
      icon: <BrainCircuit className="h-6 w-6" />,
      className: "lg:col-span-1",
      color: "green"
    }
  ];

  export default function ProgramStructure() {
    return (
      <section className="py-32 bg-slate-950"> {/* Changed to dark background */}
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4"> {/* Light text */}
              Your Journey to Trading Mastery
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg"> {/* Adjusted text color */}
              A structured approach that builds your skills progressively
            </p>
          </div>
  
          {/* Program Phases */}
          <div className="grid md:grid-cols-2 gap-8 mb-24">
            {programPhases.map((phase, index) => (
              <Card key={index} className="relative overflow-hidden bg-slate-900 border-slate-800"> {/* Dark card */}
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <span className="text-sm font-medium text-blue-400"> {/* Adjusted color */}
                      {phase.duration}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2"> {/* Light text */}
                    {phase.phase}
                  </h3>
                  <p className="text-gray-400 mb-4"> {/* Adjusted color */}
                    {phase.description}
                  </p>
                  <ul className="space-y-2">
                    {phase.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" /> {/* Adjusted color */}
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
  
          {/* Weekly Schedule */}
          <div className="bg-slate-900 rounded-2xl p-8 mb-24 border border-slate-800"> {/* Dark background */}
            <h3 className="text-2xl font-bold text-white mb-8 text-center">
              Weekly Live Sessions
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {weeklySchedule.map((session, index) => (
                <div 
                  key={index}
                  className="bg-slate-800 rounded-xl p-6 border border-slate-700" /* Darker card */
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-gray-300">
                      {session.day}
                    </span>
                    <span className="text-sm font-medium text-blue-400">
                      {session.time}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white mb-2">
                    {session.type}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {session.description}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-blue-900/20 rounded-lg border border-blue-800/30">
              <p className="text-center text-blue-300 text-sm">
                All sessions are recorded and available for replay. 
                Can not make it live? Watch at your convenience and get answers in the next Q&A.
              </p>
            </div>
          </div>
  
          {/* Additional Support - Bento Box Style */}
          <div className="mt-24">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">
              Comprehensive Support System
            </h3>
            <p className="text-gray-400 mb-12 max-w-2xl mx-auto text-center">
              Beyond the structured sessions, you will have access to a complete ecosystem of trading support
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[1200px] mx-auto">
                {supportFeatures.map((feature, index) => (
                    <GradientCard
                    key={index}
                    gradientColor={
                        feature.color === 'blue' ? 'rgba(59, 130, 246, 0.2)' :
                        feature.color === 'purple' ? 'rgba(147, 51, 234, 0.2)' :
                        'rgba(16, 185, 129, 0.2)'
                    }
                    className={feature.className}
                    >
                    <div className={`${colorVariants[feature.color]} rounded-lg w-12 h-12 flex items-center justify-center mb-4`}>
                        {feature.icon}
                    </div>
                    <h4 className="font-semibold text-white mb-3 text-lg">
                        {feature.title}
                    </h4>
                    <p className="text-gray-400">
                        {feature.description}
                    </p>
                    </GradientCard>
                ))}
            </div>
          </div>
        </div>
      </section>
    )
  }