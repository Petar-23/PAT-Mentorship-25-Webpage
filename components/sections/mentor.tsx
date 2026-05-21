import Image from 'next/image'
import { Users } from "@phosphor-icons/react/dist/ssr/Users"
import {
  LazyTradingPerformance,
  MentorLessonCard,
  MentorPayoutCard,
  MentorStatsCards,
  MentorWhopReviewCard,
} from "@/components/sections/mentor-cards"

// Main Mentor Section
export default function MentorSection() {
  return (
    <section className="py-12 sm:py-24 bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-950/20" />
      
      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        {/* Section Header (global, damit Chart & Mentor-Bild oben bündig starten) */}
        <div className="mb-5 sm:mb-8 text-center">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-3 sm:pr-4 py-1 rounded-full bg-white/10 ring-1 ring-white/20 mb-3 sm:mb-4">
            <div className="bg-blue-500/20 text-blue-400 rounded-full p-1.5 sm:p-2 flex items-center justify-center">
              <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-blue-400">Dein Mentor</span>
          </div>
          <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white">
            Petar
          </h2>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden space-y-5">
          <div>
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
              <Image
                src="/images/mentor_petar.png"
                alt="Trading Mentor"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 520px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-4">
              <MentorStatsCards compact />
            </div>

            <div className="mt-4">
              <MentorWhopReviewCard compact />
            </div>
          </div>

          <div>
            <span data-mentor-target="experience" data-mentor-viewport="mobile" />
            <span data-mentor-target="mentees" data-mentor-viewport="mobile" />
            <p className="text-sm sm:text-lg text-gray-300 leading-relaxed mb-3">
              Ich habe mich intensiv mit dem Trading nach 
              ICT&apos;s Smart Money Konzepten beschäftigt und über 1000 
              Stunden Videomaterial durchgearbeitet. Dazu gehören 
              ICT&apos;s Private Mentorship, die ICT 2025 Lecture Series sowie die Mentorships der Jahre 2022, 2023, 2024 - und vieles mehr.
            </p>
            <p className="text-sm sm:text-lg text-gray-300 leading-relaxed mb-3">
              Seit Anfang 2024, lehre ich diese Konzepte in meiner eigenen privaten Mentorship. 
              Mittlerweile konnten 130+ Mentees messbare Erfolge erzielen.
            </p>
            <p className="text-sm sm:text-lg text-gray-300 leading-relaxed">
              Ich werbe nicht mit Lifestyle und Luxus, sondern mit echten Trades 
              - schaue dir gerne meinen YouTube Kanal an. Mein Ziel ist es, dir 
              eine nachhaltige Fähigkeit zu vermitteln, mit der du ein stabiles monatliches Einkommen erzielen kannst.
            </p>
          </div>

          <div className="space-y-4 sm:space-y-8">
            <div data-mentor-target="performance" data-mentor-viewport="mobile">
              <LazyTradingPerformance />
            </div>

            <div data-mentor-target="payout" data-mentor-viewport="mobile">
              <MentorPayoutCard compact />
            </div>
          </div>

          <MentorLessonCard compact />
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-8 sm:gap-12 items-start">
          {/* Left Column - Text and Trading Performance */}
          <div className="space-y-6 sm:space-y-8">
            <div data-mentor-target="performance" data-mentor-viewport="desktop">
              <LazyTradingPerformance />
            </div>

            <div data-mentor-target="payout" data-mentor-viewport="desktop">
              <MentorPayoutCard />
            </div>

            <MentorLessonCard />
          </div>

          {/* Right Column - Image and Stats */}
          <div className="flex flex-col h-full">
            <div className="flex-1">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
                <Image
                  src="/images/mentor_petar.png"
                  alt="Trading Mentor"
                  fill
                  className="object-cover"
                  sizes="520px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                <MentorStatsCards />
              </div>

              <div className="mt-6">
                <span data-mentor-target="experience" data-mentor-viewport="desktop" />
                <span data-mentor-target="mentees" data-mentor-viewport="desktop" />
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Ich habe mich intensiv mit dem Trading nach 
                  ICT&apos;s Smart Money Konzepten beschäftigt und über 1000 
                  Stunden Videomaterial durchgearbeitet. Dazu gehören 
                  ICT&apos;s Private Mentorship, die ICT 2025 Lecture Series sowie die Mentorships der Jahre 2022, 2023, 2024 - und vieles mehr.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed mb-4">
                  Seit Anfang 2024, lehre ich diese Konzepte in meiner eigenen privaten Mentorship. 
                  Mittlerweile konnten 130+ Mentees messbare Erfolge erzielen.
                </p>
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
                  Ich werbe nicht mit Lifestyle und Luxus, sondern mit echten Trades 
                  - schaue dir gerne meinen YouTube Kanal an. Mein Ziel ist es, dir 
                  eine nachhaltige Fähigkeit zu vermitteln, mit der du ein stabiles monatliches Einkommen erzielen kannst.
                </p>

                <div className="mt-6">
                  <MentorWhopReviewCard />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
