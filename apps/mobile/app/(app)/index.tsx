import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../src/stores/auth'
import { useSessionLock } from '../../src/hooks/useSessionLock'
import api from '../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../src/theme'

function useDashboardData() {
  const token = useAuthStore((s) => s.token)

  const patients = useQuery({
    queryKey: ['patients', 'count'],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get('/patients?page=1&limit=100&status=ADMITTED')
      return ((res.data.data as unknown[]) ?? []).length
    },
  })
  const tasks = useQuery({
    queryKey: ['tasks', 'pending-count'],
    enabled: !!token,
    queryFn: async () => {
      const res = await api.get('/tasks?status=PENDING')
      return ((res.data.data as unknown[]) ?? []).length
    },
  })
  return { patients, tasks }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user)
  const { locked, unlock, unlocking } = useSessionLock()
  const { patients, tasks } = useDashboardData()

  if (locked) {
    return (
      <View style={styles.lockScreen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.lockLogoWrap}>
          <Text style={styles.lockMonogram}>M</Text>
        </View>
        <Text style={styles.lockTitle}>MedLog AI</Text>
        <Text style={styles.lockSub}>Your session has been locked</Text>

        <TouchableOpacity style={styles.unlockBtn} onPress={unlock} disabled={unlocking} activeOpacity={0.85}>
          {unlocking ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.unlockText}>🔓  Unlock with Biometrics</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            await useAuthStore.getState().clearAuth()
            router.replace('/(auth)/login')
          }}
          style={styles.signOutBtn}
        >
          <Text style={styles.signOutText}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const rawName = user?.name ?? 'Doctor'
  const firstName = rawName.replace(/^Dr\.?\s*/i, '').split(' ')[0] || rawName

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, Dr. {firstName}
          </Text>
          <Text style={styles.date}>{formatDate()}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{firstName.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Stats row */}
        <Text style={styles.sectionLabel}>Overview</Text>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, styles.statCardBlue]}
            onPress={() => router.push('/(app)/patients')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.statIcon}>👥</Text>
            </View>
            {patients.isLoading ? (
              <ActivityIndicator color={colors.white} style={{ marginTop: spacing.md }} />
            ) : (
              <Text style={styles.statNumber}>{patients.data ?? '—'}</Text>
            )}
            <Text style={styles.statLabelWhite}>Patients Admitted</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, styles.statCardAmber]}
            onPress={() => router.push('/(app)/tasks')}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBg, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.statIcon}>✓</Text>
            </View>
            {tasks.isLoading ? (
              <ActivityIndicator color={colors.white} style={{ marginTop: spacing.md }} />
            ) : (
              <Text style={styles.statNumber}>{tasks.data ?? '—'}</Text>
            )}
            <Text style={styles.statLabelWhite}>Pending Tasks</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsScroll}
        >
          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push('/(app)/patients')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.actionEmoji}>📝</Text>
            </View>
            <Text style={styles.actionLabel}>New Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push('/(app)/tasks/new')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.successLight }]}>
              <Text style={styles.actionEmoji}>+</Text>
            </View>
            <Text style={styles.actionLabel}>New Task</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push('/(app)/patients')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: colors.warningLight }]}>
              <Text style={styles.actionEmoji}>🔬</Text>
            </View>
            <Text style={styles.actionLabel}>Scan Lab</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionChip}
            onPress={() => router.push('/(app)/patients')}
            activeOpacity={0.75}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <Text style={styles.actionEmoji}>🏥</Text>
            </View>
            <Text style={styles.actionLabel}>All Patients</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Recent activity placeholder */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionLabel}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/patients')}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyActivityIcon}>📋</Text>
          <Text style={styles.emptyActivityText}>Recent patient activity will appear here</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  greeting: {
    ...typography.h2,
    lineHeight: 28,
  },
  date: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },

  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: 32,
  },

  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  statCardBlue: {
    backgroundColor: colors.primary,
  },
  statCardAmber: {
    backgroundColor: colors.warning,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statIcon: {
    fontSize: 20,
  },
  statNumber: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -1,
  },
  statLabelWhite: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },

  actionsScroll: {
    gap: spacing.md,
    paddingRight: spacing.xxl,
    marginBottom: spacing.xl,
  },
  actionChip: {
    alignItems: 'center',
    width: 80,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray700,
    textAlign: 'center',
  },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  emptyActivity: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xxxl,
    alignItems: 'center',
    ...shadow.sm,
  },
  emptyActivityIcon: {
    fontSize: 32,
    marginBottom: spacing.md,
    opacity: 0.4,
  },
  emptyActivityText: {
    ...typography.bodySmall,
    textAlign: 'center',
  },

  // Lock screen
  lockScreen: {
    flex: 1,
    backgroundColor: '#0C1020',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  lockLogoWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.lg,
  },
  lockMonogram: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.white,
  },
  lockTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  lockSub: {
    fontSize: 15,
    color: colors.gray400,
    marginBottom: 52,
  },
  unlockBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 15,
    paddingHorizontal: 40,
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  unlockText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  signOutBtn: {
    paddingVertical: spacing.md,
  },
  signOutText: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '500',
  },
})
