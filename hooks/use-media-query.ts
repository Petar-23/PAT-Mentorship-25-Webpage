import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Initial check on client-side
    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query)
      setMatches(media.matches)

      // Create listener function
      const listener = (e: MediaQueryListEvent) => {
        setMatches(e.matches)
      }

      // Add listener
      media.addEventListener('change', listener)

      // Clean up
      return () => {
        media.removeEventListener('change', listener)
      }
    }
  }, [query])

  return matches
}