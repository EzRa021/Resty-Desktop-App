"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const mediaQuery = window.matchMedia(query)
    setMatches(mediaQuery.matches)

    const handler = (event) => {
      setMatches(event.matches)
    }

    mediaQuery.addEventListener("change", handler)

    return () => {
      mediaQuery.removeEventListener("change", handler)
    }
  }, [query])

  // Avoid hydration mismatch by returning false on the server
  if (!mounted) return false

  return matches
}
