import { Button } from "@/components/ui/button"
import { ArrowRight, PlayCircle, Users } from "lucide-react"
import Link from "next/link"

export default function Hero() {
  return (
    <section className="relative py-20 px-4 md:px-6 lg:py-32 overflow-hidden bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8">
            <div className="inline-block">
              <span className="inline-flex items-center rounded-full px-4 py-1 text-sm font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10">
                Limited to 100 Seats • Starting March 2025
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
              Master Price Action Trading Through Live 
              <span className="text-blue-600"> Mentorship</span>
            </h1>
            
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              Forget pre-recorded courses with outdated examples. Join a dynamic mentorship program 
              where you will learn from live market action, with real-time analysis and direct guidance.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="#waitlist" className="flex items-center gap-2">
                  Secure Your Spot
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              
              <Button size="lg" variant="outline" asChild>
                <Link href="#features">
                  Program Details
                </Link>
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">€150</p>
                <p className="text-sm text-gray-600">Monthly Fee</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">2-3x</p>
                <p className="text-sm text-gray-600">Weekly Sessions</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">100</p>
                <p className="text-sm text-gray-600">Limited Seats</p>
              </div>
            </div>
          </div>

          {/* Right Column - Visual Element */}
          <div className="relative lg:h-[600px] flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-10 blur-2xl" />
            <div className="relative bg-white p-8 rounded-xl shadow-xl">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <PlayCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Live Trading Sessions</h3>
                    <p className="text-sm text-gray-600">Real-time market analysis</p>
                  </div>
                </div>
                
                <div className="h-px bg-gray-100" />
                
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Public 1:1 Sessions</h3>
                    <p className="text-sm text-gray-600">Direct mentoring & Q&A</p>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />
                
                <div className="flex items-center gap-4 mt-2">
                  <div className="bg-green-50 rounded-lg p-3 w-full">
                    <p className="text-sm text-green-800 font-medium">
                      Complete the year & get lifetime access to all materials
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}