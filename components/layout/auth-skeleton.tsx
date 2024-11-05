// src/components/layout/auth-skeleton.tsx
export function AuthButtonsSkeleton() {
    return (
      <div className="flex items-center gap-4">
        <div className="w-20 h-9 bg-gray-100 rounded-md animate-pulse" />
        <div className="w-20 h-9 bg-gray-100 rounded-md animate-pulse" />
        <div className="w-20 h-9 bg-gray-100 rounded-md animate-pulse" />
      </div>
    )
  }