import { useState, useCallback } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'
import { Alert } from 'react-native'

export type BiometricResult = 'success' | 'cancelled' | 'unavailable' | 'failed'

interface UseBiometricAuthReturn {
  isSupported: boolean | null
  authenticate: (reason?: string) => Promise<BiometricResult>
  checkSupport: () => Promise<boolean>
}

export function useBiometricAuth(): UseBiometricAuthReturn {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  const checkSupport = useCallback(async (): Promise<boolean> => {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    const supported = compatible && enrolled
    setIsSupported(supported)
    return supported
  }, [])

  const authenticate = useCallback(async (reason = 'Confirm your identity to continue'): Promise<BiometricResult> => {
    const supported = await checkSupport()
    if (!supported) return 'unavailable'

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    const isFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        biometricsSecurityLevel: 'strong',
      })

      if (result.success) return 'success'
      if (result.error === 'user_cancel' || result.error === 'system_cancel') return 'cancelled'
      return 'failed'
    } catch {
      Alert.alert(
        `${isFaceId ? 'Face ID' : 'Fingerprint'} Error`,
        'Biometric authentication failed. Please try again.'
      )
      return 'failed'
    }
  }, [checkSupport])

  return { isSupported, authenticate, checkSupport }
}
