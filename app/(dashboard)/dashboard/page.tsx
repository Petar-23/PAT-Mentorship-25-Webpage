// src/app/dashboard/page.tsx
'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
//import { Button } from '@/components/ui/button'
import { AlertCircle, CreditCard } from 'lucide-react'
import { CheckoutButton } from '@/components/ui/checkout-button'
import { Button } from '@/components/ui/button'
import { ManageSubscriptionButton } from '@/components/ui/manage-subscription'
import { SubscriptionStatus } from '@/components/dashboard/subscription-status'
//import { BlurredContent } from '@/components/dashboard/blurred-content'
import { SubscriptionSuccessModal } from '@/components/dashboard/subscription-success-modal'

interface SubscriptionDetails {
  status: string;
  startDate: string;
  isPending: boolean;
  isCanceled: boolean;
  cancelAt: string | null;
}

interface DashboardProps {
  initialData: {
    hasSubscription: boolean;
    subscriptionDetails: SubscriptionDetails | null;
    user: {
      firstName: string | null;
    }
  }
}

export default function DashboardPage({ initialData }: DashboardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showSuccess = searchParams.get('success') === 'true'

  const startDate = new Date('2025-03-01')
  const programStarted = new Date() >= startDate
  
  // Check if user has never had a subscription
  const hasSubscriptionHistory = initialData.subscriptionDetails !== null


  // Show the subscription required message only for completely new users
  if (!hasSubscriptionHistory) {
    return (
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-8">
          Welcome, {initialData.user.firstName || 'Member'}!
        </h1>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Subscription Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              To access the mentorship program content and community, you need to purchase a subscription. 
              The program starts March 1st, 2025, but you can secure your spot now.
            </p>
            <CheckoutButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if user can access content
  const canAccessContent = initialData.hasSubscription && 
    !initialData.subscriptionDetails?.isCanceled &&
    programStarted


  return (
    <>
      {showSuccess && (
        <SubscriptionSuccessModal 
          isOpen={true} 
          onClose={() => {
            router.replace('/dashboard')
          }} 
        />
      )}

      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold mb-8">
          Welcome, {initialData.user.firstName || 'Member'}!
        </h1>

        {/* Subscription Status with Countdown */}
        {initialData.subscriptionDetails && (
          <div className="mb-8">
            <SubscriptionStatus
              startDate={initialData.subscriptionDetails.startDate}
              status={initialData.subscriptionDetails.status}
              isPending={initialData.subscriptionDetails.isPending}
              isCanceled={initialData.subscriptionDetails.isCanceled}
              cancelAt={initialData.subscriptionDetails.cancelAt}
              //onResubscribe={handleResubscribe}
            />
          </div>
        )}
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Discord Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg 
                  className="h-5 w-5 text-[#5865F2]" 
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.118.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
                </svg>
                Discord Community
              </CardTitle>
              <CardDescription>
                Connect with mentors and fellow mentees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Join our exclusive Discord community for live sessions, discussions, and networking.
              </p>
              {canAccessContent && programStarted ? (
                <a 
                  href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-[#5865F2] text-white rounded-md hover:bg-[#4752C4] transition-colors gap-2"
                >
                  Join Discord Server
                </a>
              ) : (
                <Button 
                  className="w-full bg-[#5865F2] hover:bg-[#5865F2] cursor-not-allowed opacity-60"
                  disabled
                >
                  Available March 1st, 2025
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Whop Access */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
              <CardDescription>
                Access your learning materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Access your video lessons, resources, and track your progress through the program.
              </p>
              {canAccessContent && programStarted ? (
                <a 
                  href={process.env.NEXT_PUBLIC_WHOP_COURSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors gap-2"
                >
                  Go to Course Platform
                </a>
              ) : (
                <Button 
                  className="w-full bg-black hover:bg-black cursor-not-allowed opacity-60"
                  disabled
                >
                  Available March 1st, 2025
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Subscription Management */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Membership Management
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                {initialData.subscriptionDetails?.isCanceled ? (
                  <p className="text-red-600">
                    Your subscription has been canceled. Resubscribe to secure your spot for the program starting March 1st, 2025.
                  </p>
                ) : (
                  <>
                    <p>Your subscription is scheduled to start on March 1st, 2025.</p>
                    <p>You can manage your payment method and subscription settings below.</p>
                  </>
                )}
              </div>
              <ManageSubscriptionButton />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}