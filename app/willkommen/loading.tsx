import { SpinnerGap } from '@phosphor-icons/react/dist/ssr/SpinnerGap'
import { Card, CardContent } from '@/components/ui/card'

export default function WillkommenLoading() {
  return (
    <div className="min-h-[70vh] bg-gray-50 px-4 py-10 sm:py-16">
      <Card className="mx-auto max-w-xl border-2 shadow-sm" role="status" aria-live="polite">
        <CardContent className="p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <SpinnerGap aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          </div>
          <h1 className="mt-5 text-balance text-2xl font-bold text-gray-900 sm:text-3xl">Zahlung wird bestätigt</h1>
          <p className="mt-3 text-pretty leading-relaxed text-gray-600">
            Einen Moment, wir richten deinen Zugang ein. Bitte schließe dieses Fenster nicht.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
