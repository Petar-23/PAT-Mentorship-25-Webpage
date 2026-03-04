// app/mentorship/page/[slug]/loading.tsx

export default function Loading() {
  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="hidden lg:block w-80 border-r border-border bg-gray-100/50 animate-pulse" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <div className="h-8 w-32 bg-muted rounded" />
          <div className="h-10 w-2/3 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded mt-6" />
          <div className="h-4 w-5/6 bg-muted rounded" />
          <div className="h-4 w-4/6 bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded mt-4" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-32 w-full bg-muted rounded mt-6" />
        </div>
      </div>
    </div>
  )
}
