// src/hooks/useCustomerCount.ts
import { useState, useEffect } from 'react'

export function useCustomerCount() {
  const [count, setCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/customer-count')
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error('Failed to fetch customer count')
        }

        setCount(data.count)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        console.error('Error fetching customer count:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCount()
  }, [])

  return { count, isLoading, error }
}