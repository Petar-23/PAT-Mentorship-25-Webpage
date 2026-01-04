// src/components/blurred-content.tsx
interface BlurredContentProps {
    children: React.ReactNode
    isBlurred: boolean
    message?: string
  }
  
  export function BlurredContent({ children, isBlurred, message }: BlurredContentProps) {
    if (!isBlurred) {
      return children
    }
  
    return (
      <div className="relative">
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 px-4 py-2 rounded-md shadow-lg">
            <p className="text-sm font-medium text-gray-900">
              {message || 'Available March 1st, 2026'}
            </p>
          </div>
        </div>
      </div>
    )
  }