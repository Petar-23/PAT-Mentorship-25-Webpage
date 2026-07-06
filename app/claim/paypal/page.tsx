import { PayPalClaimForm } from '@/components/claim/paypal-claim-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'

export default async function PayPalClaimPage() {
  const { userId } = await auth()

  if (!userId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-neutral-600">
              Bitte melde dich zuerst an, um deinen PayPal-Account zu
              verknuepfen.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/sign-in">Anmelden</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <PayPalClaimForm />
}
