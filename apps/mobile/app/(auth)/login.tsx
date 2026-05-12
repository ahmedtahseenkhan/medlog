import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/stores/auth'
import { api } from '../../src/lib/api'
import type { User } from '../../src/types'
import { colors, spacing, radius, shadow } from '../../src/theme'

async function registerForPushNotificationsAsync() {
  try {
    const N = await import('expo-notifications').catch(() => null)
    if (!N) return null
    const { status } = await N.requestPermissionsAsync()
    if (status !== 'granted') return null
    return (await N.getExpoPushTokenAsync()).data
  } catch { return null }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const setAuth = useAuthStore(s => s.setAuth)
  const loginAsGuest = useAuthStore(s => s.loginAsGuest)

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        '/auth/login', { email, password }
      )
      await setAuth(data.accessToken, data.refreshToken, data.user)
      registerForPushNotificationsAsync().then(token => {
        if (token) api.post('/push-tokens/register', { token, platform: 'expo' }).catch(() => {})
      })
      router.replace('/(app)/')
    } catch (err: any) {
      Alert.alert('Sign In Failed', 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGuest() {
    setGuestLoading(true)
    await loginAsGuest()
    setGuestLoading(false)
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />

      {/* ── Teal hero ── */}
      <View style={s.hero}>
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>M</Text>
          </View>
          <View>
            <Text style={s.appName}>MedLog AI</Text>
            <Text style={s.appTagline}>Clinical Documentation</Text>
          </View>
        </View>
        <Text style={s.heroHeadline}>Your patients,{'\n'}always with you.</Text>
      </View>

      {/* ── White form panel ── */}
      <ScrollView
        style={s.panel}
        contentContainerStyle={s.panelContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.formTitle}>Welcome back</Text>

        {/* Email */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Email address</Text>
          <TextInput
            style={[s.input, emailFocused && s.inputFocused]}
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
        <View style={s.field}>
          <Text style={s.fieldLabel}>Password</Text>
          <TextInput
            style={[s.input, passwordFocused && s.inputFocused]}
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

        <TouchableOpacity style={s.forgotWrap} activeOpacity={0.6}>
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in */}
        <TouchableOpacity
          style={[s.primaryBtn, loading && s.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <TouchableOpacity style={s.signupRow} onPress={() => router.push('/(auth)/signup')} activeOpacity={0.7}>
          <Text style={s.signupText}>
            Don't have an account? <Text style={s.signupLink}>Create one</Text>
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>or</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Guest */}
        <TouchableOpacity
          style={[s.guestBtn, guestLoading && s.btnDisabled]}
          onPress={handleGuest}
          disabled={guestLoading}
          activeOpacity={0.85}
        >
          <View style={s.guestBtnContent}>
            <View style={s.guestIcon}>
              <Text style={s.guestIconText}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.guestTitle}>{guestLoading ? 'Opening…' : 'Continue as Guest'}</Text>
              <Text style={s.guestSub}>Full features · Data saved on device</Text>
            </View>
            <Text style={s.guestChevron}>›</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },

  hero: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl + 8,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xxl },
  logoBox: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: colors.white },
  appName: { fontSize: 16, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  appTagline: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginTop: 1 },
  heroHeadline: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: -0.8, lineHeight: 40 },

  panel: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1 },
  panelContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl },

  formTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xl, letterSpacing: -0.3 },

  field: { marginBottom: spacing.lg },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSoft, marginBottom: spacing.sm, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primaryLight },

  forgotWrap: { alignItems: 'flex-end', marginBottom: spacing.xl, marginTop: -spacing.sm },
  forgotText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  primaryBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  btnDisabled: { opacity: 0.55 },

  signupRow: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.xl },
  signupText: { fontSize: 14, color: colors.textMid },
  signupLink: { color: colors.primary, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  dividerText: { fontSize: 12, color: colors.textSoft, fontWeight: '600' },

  guestBtn: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.sm,
  },
  guestBtnContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guestIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primaryMid, alignItems: 'center', justifyContent: 'center' },
  guestIconText: { fontSize: 18, fontWeight: '800', color: colors.primary },
  guestTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  guestSub: { fontSize: 12, color: colors.textSoft },
  guestChevron: { fontSize: 24, color: colors.line, marginLeft: 'auto' },
})
