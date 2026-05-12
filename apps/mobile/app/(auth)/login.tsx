import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/stores/auth'
import { api } from '../../src/lib/api'
import type { User } from '../../src/types'
import { colors, typography, spacing, radius, shadow } from '../../src/theme'

async function registerForPushNotificationsAsync() {
  try {
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

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [emailNotVerified, setEmailNotVerified] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [guestLoading, setGuestLoading] = useState(false)
  const setAuth = useAuthStore(s => s.setAuth)
  const loginAsGuest = useAuthStore(s => s.loginAsGuest)

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
      registerForPushNotificationsAsync().then(token => {
        if (token) api.post('/push-tokens/register', { token, platform: 'expo' }).catch(() => {})
      })
      router.replace('/(app)/')
    } catch (err: any) {
      const responseData = err?.response?.data
      if (responseData?.code === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true)
        Alert.alert('Email Not Verified', responseData.message ?? 'Please verify your email before logging in.', [{ text: 'OK' }])
      } else {
        Alert.alert('Sign In Failed', 'Invalid email or password.')
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

  async function handleGuest() {
    setGuestLoading(true)
    await loginAsGuest()
    setGuestLoading(false)
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />

      {/* Dark top section */}
      <View style={styles.top}>
        <SafeAreaView>
          <View style={styles.wordmark}>
            <View style={styles.mark}><Text style={styles.markText}>M</Text></View>
            <View>
              <Text style={styles.appName}>MedLog AI</Text>
              <Text style={styles.appRole}>Clinical Documentation</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* White form section */}
      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.formTitle}>Sign in</Text>
        <Text style={styles.formSubtitle}>to your MedLog account</Text>

        <View style={styles.fieldset}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder="doctor@hospital.om"
              placeholderTextColor={colors.textSoft}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={[styles.input, passwordFocused && styles.inputFocused]}
              placeholder="••••••••••"
              placeholderTextColor={colors.textSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>
        </View>

        {/* Resend verification */}
        {emailNotVerified && (
          <View style={styles.verifyBox}>
            <Text style={styles.verifyText}>Your email is not verified.</Text>
            <TouchableOpacity onPress={handleResendVerification} disabled={resendLoading} activeOpacity={0.7}>
              <Text style={styles.verifyLink}>{resendLoading ? 'Sending…' : 'Resend verification email'}</Text>
            </TouchableOpacity>
            {resendMessage ? <Text style={styles.verifyMsg}>{resendMessage}</Text> : null}
          </View>
        )}

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.signInBtn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.88}
        >
          <Text style={styles.signInBtnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.6}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest access */}
        <TouchableOpacity
          style={[styles.guestBtn, guestLoading && styles.btnDisabled]}
          onPress={handleGuest}
          disabled={guestLoading}
          activeOpacity={0.88}
        >
          <View style={styles.guestBtnInner}>
            <View>
              <Text style={styles.guestBtnTitle}>
                {guestLoading ? 'Opening…' : 'Continue without account'}
              </Text>
              <Text style={styles.guestBtnSub}>All data stored locally on this device</Text>
            </View>
            <Text style={styles.guestArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Sign up */}
        <TouchableOpacity
          style={styles.signUpRow}
          onPress={() => router.push('/(auth)/signup')}
          activeOpacity={0.7}
        >
          <Text style={styles.signUpText}>
            New to MedLog?{' '}
            <Text style={styles.signUpLink}>Create account</Text>
          </Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },

  // ── Dark top ──
  top: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.xxl,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
    paddingBottom: spacing.xxxl,
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: 22, fontWeight: '800', color: colors.white },
  appName: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  appRole: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 1, letterSpacing: 0.2 },

  // ── Form ──
  formScroll: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  formContainer: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl },
  formTitle: { fontSize: 26, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
  formSubtitle: { fontSize: 15, color: colors.textMid, marginTop: spacing.xs, marginBottom: spacing.xxl },

  fieldset: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  field: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  input: {
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
    backgroundColor: 'transparent',
  },
  inputFocused: { color: colors.primary },

  verifyBox: {
    backgroundColor: colors.abnormalBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.abnormalBorder,
  },
  verifyText: { fontSize: 13, color: colors.abnormal, marginBottom: spacing.xs },
  verifyLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  verifyMsg: { fontSize: 12, color: colors.textMid, marginTop: spacing.sm },

  signInBtn: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  signInBtnText: { color: colors.white, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  btnDisabled: { opacity: 0.5 },

  forgotBtn: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.xl },
  forgotText: { fontSize: 13, color: colors.primary, fontWeight: '500' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dividerLabel: { fontSize: 12, color: colors.textSoft, fontWeight: '600' },

  guestBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.bg,
  },
  guestBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guestBtnTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  guestBtnSub: { fontSize: 12, color: colors.textSoft },
  guestArrow: { fontSize: 24, color: colors.textSoft },

  signUpRow: { alignItems: 'center', paddingVertical: spacing.sm },
  signUpText: { fontSize: 14, color: colors.textMid },
  signUpLink: { fontWeight: '700', color: colors.primary },
})
