import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../stores/auth'

const INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes
const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

/**
 * Clears auth and redirects to /login after INACTIVITY_MS of no user input.
 * Call this once at the app root — it self-cleans on unmount.
 */
export function useInactivityLock(onLock: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const token = useAuthStore((s) => s.token)

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      clearAuth()
      onLock()
    }, INACTIVITY_MS)
  }, [clearAuth, onLock])

  useEffect(() => {
    if (!token) return

    reset()
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      EVENTS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [token, reset])
}
