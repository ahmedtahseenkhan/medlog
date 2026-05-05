import { useEffect, useRef, useCallback, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useBiometricAuth } from './useBiometricAuth'
import { useAuthStore } from '../stores/auth'

const BACKGROUND_LOCK_MS = 5 * 60 * 1000 // 5 min in background triggers lock

export function useSessionLock() {
  const [locked, setLocked] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const backgroundedAt = useRef<number | null>(null)
  const { authenticate, checkSupport } = useBiometricAuth()
  const token = useAuthStore((s) => s.token)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const unlock = useCallback(async () => {
    if (unlocking) return
    setUnlocking(true)
    try {
      const biometricAvailable = await checkSupport()
      if (biometricAvailable) {
        const result = await authenticate('Unlock MedLog AI')
        if (result === 'success') {
          setLocked(false)
          return
        }
        if (result === 'failed') {
          // After biometric fail, fall through to sign out
          await clearAuth()
          setLocked(false)
        }
        // 'cancelled' — stay locked, user can try again
      } else {
        // No biometrics — just lock with a forced re-login
        await clearAuth()
        setLocked(false)
      }
    } finally {
      setUnlocking(false)
    }
  }, [authenticate, checkSupport, clearAuth, unlocking])

  useEffect(() => {
    if (!token) return

    const subscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now()
      } else if (state === 'active') {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
        backgroundedAt.current = null
        if (elapsed >= BACKGROUND_LOCK_MS) {
          setLocked(true)
        }
      }
    })

    return () => subscription.remove()
  }, [token])

  return { locked, unlock, unlocking }
}
