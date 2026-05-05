import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar, Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/stores/auth'
import { api } from '../../src/lib/api'
import type { User } from '@medlog/types'
import { colors, typography, spacing, radius, shadow } from '../../src/theme'

async function registerForPushNotificationsAsync() {
  try {
    // Dynamic import to avoid hard crash if expo-notifications not available
    const Notifications = await import('expo-notifications').catch(() => null)
    if (!Notifications) return null
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return null
    const tokenData = await Notifications.getExpoPushTokenAsync()
    return tokenData.data
  } catch {
    return null
  }
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.42

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const setAuth = useAuthStore((s) => s.setAuth)
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    setEmailNotVerified(false)
    setResendMessage('')
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/login',
        { email, password },
      )
      await setAuth(data.accessToken, data.refreshToken, data.user)
      // Register push token in background — non-blocking
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          api.post('/push-tokens/register', { token, platform: 'expo' }).catch(() => {})
        }
      })
      router.replace('/(app)/')
    } catch (err: any) {
      const responseData = err?.response?.data
      if (responseData?.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true)
        Alert.alert(
          'Email Not Verified',
          responseData.message ?? 'Please verify your email before logging in.',
          [{ text: 'OK' }],
        )
      } else {
        Alert.alert('Sign In Failed', 'Invalid email or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    setResendLoading(true)
    setResendMessage('')
    try {
      await api.post('/auth/resend-verification', { email })
      setResendMessage('Verification email sent. Check your inbox.')
    } catch {
      setResendMessage('Could not resend. Please try again shortly.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Hero section — two-color panel simulating gradient */}
      <View style={styles.heroBg}>
        <View style={styles.heroTop} />
        <View style={styles.heroBottom} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo block */}
        <View style={[styles.logoArea, { height: HERO_HEIGHT - 60 }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoMonogram}>M</Text>
          </View>
          <Text style={styles.appName}>MedLog AI</Text>
          <Text style={styles.appTagline}>Clinical Documentation System</Text>
        </View>

        {/* White card panel */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>Sign in to your account to continue</Text>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="doctor@hospital.com"
              placeholderTextColor={colors.gray400}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={[styles.input, passwordFocused && styles.inputFocused]}
              placeholder="••••••••"
              placeholderTextColor={colors.gray400}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          <TouchableOpacity
            style={[styles.signInBtn, loading && styles.signInBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.signInBtnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
          </TouchableOpacity>

          {/* Resend verification — only shown after EMAIL_NOT_VERIFIED error */}
          {emailNotVerified && (
            <View style={styles.verifyWrap}>
              <TouchableOpacity
                style={[styles.resendBtn, resendLoading && styles.signInBtnDisabled]}
                onPress={handleResendVerification}
                disabled={resendLoading}
                activeOpacity={0.85}
              >
                <Text style={styles.resendBtnText}>
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </Text>
              </TouchableOpacity>
              {resendMessage ? (
                <Text style={styles.resendMessage}>{resendMessage}</Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity style={styles.forgotWrap} activeOpacity={0.6}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signupLinkWrap}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.7}
          >
            <Text style={styles.signupLinkText}>
              Don't have an account?{' '}
              <Text style={styles.signupLinkBold}>Sign up</Text>
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest login — offline mode, no server needed */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={loginAsGuest}
            activeOpacity={0.8}
          >
            <Text style={styles.guestBtnIcon}>👤</Text>
            <View>
              <Text style={styles.guestBtnTitle}>Continue as Guest</Text>
              <Text style={styles.guestBtnSubtitle}>Manage patients offline — no account needed</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTop: {
    height: '50%',
    backgroundColor: colors.primary,
  },
  heroBottom: {
    height: '50%',
    backgroundColor: colors.screenBg,
  },

  scroll: {
    flexGrow: 1,
  },

  logoArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  logoMonogram: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.3,
  },

  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: 60,
    flex: 1,
    ...shadow.lg,
  },
  cardTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    marginBottom: spacing.xxl,
  },

  fieldWrap: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.gray900,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  signInBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.md,
  },
  signInBtnDisabled: {
    opacity: 0.65,
  },
  signInBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  verifyWrap: {
    marginTop: spacing.lg,
  },
  resendBtn: {
    borderWidth: 1.5,
    borderColor: colors.warning,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: colors.warningLight,
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  resendMessage: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  forgotWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },

  signupLinkWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  signupLinkText: {
    fontSize: 14,
    color: colors.gray500,
  },
  signupLinkBold: {
    fontWeight: '700',
    color: colors.primary,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.gray200,
  },
  dividerText: {
    fontSize: 13,
    color: colors.gray400,
    fontWeight: '500',
  },

  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.gray50,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  guestBtnIcon: {
    fontSize: 28,
  },
  guestBtnTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 2,
  },
  guestBtnSubtitle: {
    fontSize: 12,
    color: colors.gray500,
  },
})
