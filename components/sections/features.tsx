import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Target, 
  Calendar, 
  MessageSquare, 
  BookOpen, 
  Award 
} from "lucide-react"

const features = [
  {
    title: "1:1 Mentorship Sessions",
    description: "Regular one-on-one sessions with experienced industry leaders tailored to your goals.",
    icon: Users,
  },
  {
    title: "Personalized Growth Plan",
    description: "Custom-designed development roadmap based on your current skills and aspirations.",
    icon: Target,
  },
  {
    title: "Flexible Scheduling",
    description: "Book sessions at times that work for you with our easy scheduling system.",
    icon: Calendar,
  },
  {
    title: "Community Support",
    description: "Join a network of like-minded professionals and share experiences.",
    icon: MessageSquare,
  },
  {
    title: "Resource Library",
    description: "Access our curated collection of learning materials and tools.",
    icon: BookOpen,
  },
  {
    title: "Progress Tracking",
    description: "Regular assessments and feedback to measure your growth.",
    icon: Award,
  },
]

export default function Features() {
  return (
    <section id="features" className="py-20 px-4 md:px-6 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our comprehensive mentorship program provides all the tools and support 
            you need to accelerate your professional growth.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="border-2 hover:border-blue-500/20 transition-colors">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-blue-500" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}