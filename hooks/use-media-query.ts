"use client"

import { useState, useEffect } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    
    const media = window.matchMedia(query)
    
    // Update matches state
    const updateMatches = () => setMatches(media.matches)
    
    // Initial check
    updateMatches()
    
    // Add listener
    media.addEventListener("change", updateMatches)
    
    // Clean up
    return () => media.removeEventListener("change", updateMatches)
  }, [query])

  return matches
}