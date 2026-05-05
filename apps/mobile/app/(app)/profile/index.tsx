import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../../src/stores/auth'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

const ROLE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  DOCTOR: { bg: colors.primaryLight, text: colors.primaryDark, label: 'Doctor' },
  NURSE: { bg: colors.successLight, text: '#065F46', label: 'Nurse' },
  ADMIN: { bg: colors.warningLight, text: '#92400E', label: 'Administrator' },
  RESIDENT: { bg: '#EDE9FE', text: '#5B21B6', label: 'Resident' },
}

function getInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function SettingsRow({
  label,
  value,
  onPress,
  danger = false,
  last = false,
}: {
  label: string
  value?: string
  onPress?: () => void
  danger?: boolean
  last?: boolean
}) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress ? <Text style={[styles.chevron, danger && styles.chevronDanger]}>›</Text> : null}
      </View>
    </Wrapper>
  )
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const handleSignOut = async () => {
    await clearAuth()
    router.replace('/(auth)/login')
  }

  const roleCfg = ROLE_CONFIG[user?.role ?? ''] ?? { bg: colors.gray100, text: colors.gray500, label: user?.role ?? '—' }
  const initials = getInitials(user?.name)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar + identity block */}
        <View style={styles.identityBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user?.name ?? '—'}</Text>
          <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleCfg.bg }]}>
            <Text style={[styles.roleBadgeText, { color: roleCfg.text }]}>{roleCfg.label}</Text>
          </View>
        </View>

        {/* Account section */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingsRow label="Email" value={user?.email ?? '—'} />
          <SettingsRow label="Role" value={roleCfg.label} last />
        </View>

        {/* Security section */}
        <SectionHeader title="Security" />
        <View style={styles.card}>
          <SettingsRow label="Change Password" onPress={() => {}} />
          <SettingsRow label="Active Sessions" onPress={() => {}} last />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.card}>
          <SettingsRow label="Sign Out" onPress={handleSignOut} danger last />
        </View>

        <Text style={styles.versionText}>MedLog AI · v1.0.0</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 48,
  },

  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  userName: {
    ...typography.h2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  userEmail: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  roleBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  sectionHeader: {
    ...typography.label,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginHorizontal: spacing.xxl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray900,
  },
  rowLabelDanger: {
    color: colors.danger,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    fontSize: 14,
    color: colors.gray400,
    maxWidth: 180,
    textAlign: 'right',
  },
  chevron: {
    fontSize: 20,
    color: colors.gray300,
    lineHeight: 22,
  },
  chevronDanger: {
    color: colors.danger,
  },

  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.gray400,
    marginTop: spacing.xxxl,
  },
})
