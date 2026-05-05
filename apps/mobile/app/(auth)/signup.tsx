import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, StatusBar,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import { api } from '../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../src/theme'

type Role = 'CONSULTANT' | 'RESIDENT' | 'INTERN'

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: 'CONSULTANT', label: 'Consultant', description: 'Senior doctor, full access' },
  { value: 'RESIDENT', label: 'Resident', description: 'Registrar/resident, standard access' },
  { value: 'INTERN', label: 'Intern / HO', description: 'House officer, supervised access' },
]

const { height: SCREEN_HEIGHT } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_HEIGHT * 0.3

export default function SignupScreen() {
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('INTERN')
  const [agreed, setAgreed] = useState(false)

  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)

  // Focus states
  const [nameFocused, setNameFocused] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [codeFocused, setCodeFocused] = useState(false)

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters.')
      return
    }
    if (!verifyCode.trim()) {
      Alert.alert('Verification Code', 'Please enter the verification code.')
      return
    }
    if (!agreed) {
      Alert.alert('Data Policy', 'You must agree to the data policy to continue.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/signup', { name, email, password, role, verifyCode })
      setStep(2)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Something went wrong. Please try again.'
      Alert.alert('Sign Up Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Two-tone hero background */}
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
        <View style={[styles.logoArea, { height: HERO_HEIGHT }]}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoMonogram}>M</Text>
          </View>
          <Text style={styles.appName}>MedLog AI</Text>
          <Text style={styles.appTagline}>Create your account</Text>
        </View>

        {/* White card */}
        <View style={styles.card}>
          {step === 1 ? (
            <>
              <Text style={styles.cardTitle}>Doctor Registration</Text>
              <Text style={styles.cardSubtitle}>Fill in your details to get started</Text>

              {/* Name */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={[styles.input, nameFocused && styles.inputFocused]}
                  placeholder="Dr. Jane Smith"
                  placeholderTextColor={colors.gray400}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                />
              </View>

              {/* Email */}
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

              {/* Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused]}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={colors.gray400}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                  />
                  <TouchableOpacity
                    style={styles.showHideBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Role selector */}
              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Role</Text>
                <View style={styles.roleList}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleOption, role === r.value && styles.roleOptionSelected]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.radioOuter, role === r.value && styles.radioOuterSelected]}>
                        {role === r.value && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.roleTextWrap}>
                        <Text style={[styles.roleLabel, role === r.value && styles.roleLabelSelected]}>
                          {r.label}
                        </Text>
                        <Text style={styles.roleDesc}>{r.description}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Verification code */}
              <View>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <TextInput
                  style={[styles.input, codeFocused && styles.inputFocused, { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' }]}
                  value={verifyCode}
                  onChangeText={setVerifyCode}
                  placeholder="0000"
                  placeholderTextColor={colors.gray300}
                  maxLength={10}
                  keyboardType="number-pad"
                  onFocus={() => setCodeFocused(true)}
                  onBlur={() => setCodeFocused(false)}
                />
                <View style={{ backgroundColor: '#FEF3C7', borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs }}>
                  <Text style={{ fontSize: 12, color: '#92400E' }}>
                    Dev mode: enter <Text style={{ fontWeight: '700' }}>0000</Text> to skip email verification
                  </Text>
                </View>
              </View>

              {/* Terms */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgreed((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                  {agreed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.termsText}>
                  I agree to use this system in compliance with hospital data policies and patient privacy regulations.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSignup}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLinkWrap}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.loginLinkBold}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Step 2 — Account created */
            <View style={styles.emailSentWrap}>
              <View style={[styles.emailIconCircle, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.emailIconText, { color: colors.success }]}>✓</Text>
              </View>
              <Text style={styles.cardTitle}>Account created!</Text>
              <Text style={styles.cardSubtitle}>
                Welcome to MedLog AI, Dr. {name.split(' ')[0]}.{'\n'}Your account is ready to use.
              </Text>

              <TouchableOpacity
                style={[styles.submitBtn, { marginTop: spacing.xxl }]}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>Go to Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLinkWrap}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.7}
              >
                <Text style={[styles.loginLinkBold, { color: colors.primary }]}>← Back to sign in</Text>
              </TouchableOpacity>
            </View>
          )}
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
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.lg,
  },
  logoMonogram: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  appTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  showHideBtn: {
    backgroundColor: colors.gray100,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderLeftWidth: 0,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  showHideText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  roleList: {
    gap: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  radioOuterSelected: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  roleTextWrap: {
    flex: 1,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  roleLabelSelected: {
    color: colors.primaryDark,
  },
  roleDesc: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: colors.gray500,
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.md,
  },
  submitBtnDisabled: {
    opacity: 0.65,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  loginLinkWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  loginLinkText: {
    fontSize: 14,
    color: colors.gray500,
  },
  loginLinkBold: {
    fontWeight: '700',
    color: colors.primary,
  },

  // Step 2 styles
  emailSentWrap: {
    alignItems: 'center',
  },
  emailIconCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emailIconText: {
    fontSize: 32,
  },
  emailHighlight: {
    fontWeight: '700',
    color: colors.gray900,
  },
  emailNote: {
    fontSize: 12,
    color: colors.gray400,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 18,
  },
  resendMsg: {
    backgroundColor: colors.successLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  resendMsgText: {
    fontSize: 13,
    color: colors.success,
    textAlign: 'center',
  },
  resendBtn: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resendBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray700,
  },
})
