import { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, StatusBar, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../../src/stores/auth'
import { useSessionLock } from '../../src/hooks/useSessionLock'
import { database } from '../../src/db/database'
import type { Patient } from '../../src/db/models/Patient'
import type { Task } from '../../src/db/models/Task'
import type { LabReport } from '../../src/db/models/LabReport'
import { Q } from '@nozbe/watermelondb'
import { colors, typography, spacing, radius, shadow } from '../../src/theme'

// ─── Live dashboard hook ───────────────────────────────────────────────────────
function useDashboard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [abnormalLabs, setAbnormalLabs] = useState(0)
  const [followUpsToday, setFollowUpsToday] = useState(0)
  const [nextAlarm, setNextAlarm] = useState<{ task: Task; patient: Patient | null } | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Observe patients
    const patSub = database.get<Patient>('patients')
      .query()
      .observe()
      .subscribe(async (pts) => {
        const now = Date.now()
        const sorted = [...pts].sort((a, b) => {
          if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
          if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1
          return (b.admissionDate ?? 0) - (a.admissionDate ?? 0)
        })
        setPatients(sorted)
        setFollowUpsToday(pts.filter(p => p.followUpDate != null && p.followUpDate <= now).length)
      })

    // Observe pending tasks
    const taskSub = database.get<Task>('tasks')
      .query(Q.where('status', Q.notEq('DONE')))
      .observe()
      .subscribe(async (tasks) => {
        setPendingTasks(tasks)
        // Find next alarm (soonest dueAt in the future)
        const now = Date.now()
        const upcoming = tasks
          .filter(t => t.dueAt && t.dueAt > now)
          .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
        if (upcoming.length > 0) {
          const t = upcoming[0]
          const patient = await database.get<Patient>('patients').find(t.patientId).catch(() => null)
          setNextAlarm({ task: t, patient })
        } else {
          setNextAlarm(null)
        }
      })

    // Abnormal labs last 24h
    const labSub = database.get<LabReport>('lab_reports')
      .query(
        Q.where('is_abnormal', true),
        Q.where('reported_at', Q.gte(Date.now() - 24 * 60 * 60 * 1000)),
      )
      .observe()
      .subscribe(labs => setAbnormalLabs(labs.length))

    setReady(true)
    return () => { patSub.unsubscribe(); taskSub.unsubscribe(); labSub.unsubscribe() }
  }, [])

  const admitted = patients.filter(p => p.status === 'ADMITTED').length
  const critical = patients.filter(p => p.status === 'CRITICAL').length

  return { patients, admitted, critical, pendingTasks, abnormalLabs, followUpsToday, nextAlarm, ready }
}

// ─── Countdown display ─────────────────────────────────────────────────────────
function useCountdown(dueAt: number | null): string {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    if (!dueAt) { setDisplay(''); return }
    const update = () => {
      const diff = dueAt - Date.now()
      if (diff <= 0) { setDisplay('Now!'); return }
      const m = Math.floor(diff / 60000)
      const h = Math.floor(m / 60)
      setDisplay(h > 0 ? `${h}h ${m % 60}m` : `${m}m`)
    }
    update()
    const iv = setInterval(update, 30000)
    return () => clearInterval(iv)
  }, [dueAt])
  return display
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Good night'
}
function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const user = useAuthStore(s => s.user)
  const isGuest = useAuthStore(s => s.isGuest)
  const { locked, unlock, unlocking } = useSessionLock()
  const { patients, admitted, critical, pendingTasks, abnormalLabs, followUpsToday, nextAlarm } = useDashboard()
  const countdown = useCountdown(nextAlarm?.task.dueAt ?? null)
  const pulse = useRef(new Animated.Value(1)).current

  // Pulse animation for critical alert
  useEffect(() => {
    if (critical === 0) return
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [critical])

  // ── Lock screen ──
  if (locked) {
    return (
      <View style={lock.screen}>
        <StatusBar barStyle="light-content" />
        <View style={lock.logo}><Text style={lock.logoText}>M</Text></View>
        <Text style={lock.title}>MedLog AI</Text>
        <Text style={lock.sub}>Your session has been locked</Text>
        <TouchableOpacity style={lock.btn} onPress={unlock} disabled={unlocking} activeOpacity={0.85}>
          <Text style={lock.btnText}>{unlocking ? 'Checking…' : '🔓  Unlock with Biometrics'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => { await useAuthStore.getState().clearAuth(); router.replace('/(auth)/login') }} style={{ paddingVertical: spacing.md }}>
          <Text style={{ color: colors.gray500, fontSize: 14 }}>Sign out instead</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const firstName = isGuest
    ? 'Doctor'
    : (user?.name ?? 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0]

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.name}>Dr. {firstName}</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <TouchableOpacity
            style={styles.handoverBtn}
            onPress={() => router.push('/(app)/handover' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.handoverIcon}>⇄</Text>
            <Text style={styles.handoverText}>Handover</Text>
          </TouchableOpacity>
        </View>

        {/* ── Critical alert banner ── */}
        {critical > 0 && (
          <Animated.View style={[styles.criticalBanner, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.criticalBannerIcon}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.criticalBannerTitle}>{critical} Critical Patient{critical > 1 ? 's' : ''}</Text>
              <Text style={styles.criticalBannerSub}>Requires immediate attention</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/patients')} activeOpacity={0.8}>
              <Text style={styles.criticalBannerAction}>View →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Next alarm countdown ── */}
        {nextAlarm && (
          <TouchableOpacity style={styles.alarmCard} onPress={() => router.push('/(app)/tasks')} activeOpacity={0.85}>
            <View style={styles.alarmLeft}>
              <Text style={styles.alarmIcon}>⏰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alarmTitle}>{nextAlarm.task.title}</Text>
              <Text style={styles.alarmPatient}>
                {nextAlarm.patient?.name ?? `MR# ${nextAlarm.patient?.mrNumber ?? '—'}`}
              </Text>
            </View>
            <View style={styles.alarmCountdown}>
              <Text style={styles.alarmCountdownNum}>{countdown}</Text>
              <Text style={styles.alarmCountdownLabel}>
                {fmtTime(nextAlarm.task.dueAt!)}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          <StatCard value={admitted} label="Admitted" color={colors.primary} icon="🛏️" onPress={() => router.push('/(app)/patients')} />
          <StatCard value={critical} label="Critical" color={colors.danger} icon="🚨" onPress={() => router.push('/(app)/patients')} />
          <StatCard value={pendingTasks.length} label="Pending tasks" color={colors.warning} icon="✓" onPress={() => router.push('/(app)/tasks')} />
          <StatCard value={abnormalLabs} label="Abnormal labs" color="#7C3AED" icon="🧪" onPress={() => router.push('/(app)/notifications')} />
        </View>

        {/* ── Follow-ups due ── */}
        {followUpsToday > 0 && (
          <TouchableOpacity style={styles.followUpBanner} onPress={() => router.push('/(app)/notifications')} activeOpacity={0.85}>
            <Text style={styles.followUpBannerIcon}>📅</Text>
            <Text style={styles.followUpBannerText}>
              {followUpsToday} patient{followUpsToday > 1 ? 's' : ''} with overdue follow-up
            </Text>
            <Text style={styles.followUpBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick actions ── */}
        <Text style={styles.sectionLabel}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickAction icon="👤" label="Add Patient" color={colors.primary} onPress={() => router.push('/(app)/patients/new')} />
          <QuickAction icon="🔔" label="Set Alarm" color="#7C3AED" onPress={() => router.push('/(app)/tasks/new')} />
          <QuickAction icon="🧪" label="Add Lab" color={colors.success} onPress={() => router.push('/(app)/patients')} />
          <QuickAction icon="⇄" label="Handover" color={colors.warning} onPress={() => router.push('/(app)/handover' as any)} />
        </View>

        {/* ── Patient ward list ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Ward Patients ({patients.filter(p => p.status !== 'DISCHARGED').length})</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/patients')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>All →</Text>
          </TouchableOpacity>
        </View>

        {patients.filter(p => p.status !== 'DISCHARGED').length === 0 ? (
          <View style={styles.emptyWard}>
            <Text style={{ fontSize: 28, marginBottom: spacing.sm, opacity: 0.3 }}>🏥</Text>
            <Text style={{ ...typography.bodySmall, textAlign: 'center' }}>No patients admitted yet{'\n'}Tap "Add Patient" to get started</Text>
          </View>
        ) : (
          patients.filter(p => p.status !== 'DISCHARGED').slice(0, 6).map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.wardCard, p.status === 'CRITICAL' && styles.wardCardCritical]}
              onPress={() => router.push(`/(app)/patients/${p.id}` as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.wardCardStripe, { backgroundColor: p.status === 'CRITICAL' ? colors.danger : colors.success }]} />
              <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.wardCardName} numberOfLines={1}>
                    {p.name ?? `MR# ${p.mrNumber}`}
                  </Text>
                  <View style={[styles.wardCardStatus, { backgroundColor: p.status === 'CRITICAL' ? colors.dangerLight : colors.successLight }]}>
                    <Text style={[styles.wardCardStatusText, { color: p.status === 'CRITICAL' ? colors.danger : colors.success }]}>
                      {p.status}
                    </Text>
                  </View>
                </View>
                {p.admissionDiagnosis ? (
                  <Text style={styles.wardCardDx} numberOfLines={1}>{p.admissionDiagnosis}</Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 2 }}>
                  {p.name ? <Text style={styles.wardCardMeta}>MR# {p.mrNumber}</Text> : null}
                  {p.wardId ? <Text style={styles.wardCardMeta}>Ward {p.wardId}</Text> : null}
                  {p.bedNumber ? <Text style={styles.wardCardMeta}>Bed {p.bedNumber}</Text> : null}
                </View>
              </View>
              <Text style={styles.wardCardArrow}>›</Text>
            </TouchableOpacity>
          ))
        )}
        {patients.filter(p => p.status !== 'DISCHARGED').length > 6 && (
          <TouchableOpacity style={styles.showMoreBtn} onPress={() => router.push('/(app)/patients')} activeOpacity={0.75}>
            <Text style={styles.showMoreText}>Show {patients.filter(p => p.status !== 'DISCHARGED').length - 6} more patients →</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ value, label, color, icon, onPress }: { value: number; label: string; color: string; icon: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[stat.card, value > 0 && { borderColor: color + '40', borderWidth: 1.5 }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={stat.icon}>{icon}</Text>
      <Text style={[stat.number, { color: value > 0 ? color : colors.gray300 }]}>{value}</Text>
      <Text style={stat.label}>{label}</Text>
    </TouchableOpacity>
  )
}

function QuickAction({ icon, label, color, onPress }: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={qa.wrap} onPress={onPress} activeOpacity={0.8}>
      <View style={[qa.circle, { backgroundColor: color + '18' }]}>
        <Text style={qa.icon}>{icon}</Text>
      </View>
      <Text style={qa.label}>{label}</Text>
    </TouchableOpacity>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingHorizontal: spacing.xl, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl, gap: spacing.md },
  greeting: { fontSize: 14, color: colors.gray500, fontWeight: '500' },
  name: { fontSize: 26, fontWeight: '800', color: colors.gray900, letterSpacing: -0.5 },
  date: { fontSize: 13, color: colors.gray400, marginTop: 2 },
  handoverBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.md,
    marginTop: 4,
  },
  handoverIcon: { fontSize: 18, color: colors.white, marginBottom: 2 },
  handoverText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.3 },

  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    gap: spacing.md,
    ...shadow.sm,
  },
  criticalBannerIcon: { fontSize: 22 },
  criticalBannerTitle: { fontSize: 15, fontWeight: '800', color: '#991B1B' },
  criticalBannerSub: { fontSize: 12, color: '#B91C1C' },
  criticalBannerAction: { fontSize: 14, fontWeight: '700', color: colors.danger },

  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.md,
  },
  alarmLeft: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  alarmIcon: { fontSize: 20 },
  alarmTitle: { fontSize: 14, fontWeight: '700', color: colors.white, marginBottom: 2 },
  alarmPatient: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  alarmCountdown: { alignItems: 'flex-end' },
  alarmCountdownNum: { fontSize: 22, fontWeight: '800', color: '#A78BFA', letterSpacing: -0.5 },
  alarmCountdownLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },

  followUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  followUpBannerIcon: { fontSize: 18 },
  followUpBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
  followUpBannerArrow: { fontSize: 16, color: colors.warning, fontWeight: '700' },

  sectionLabel: { ...typography.label, marginBottom: spacing.md },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },

  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },

  wardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden', ...shadow.sm },
  wardCardCritical: { borderWidth: 1, borderColor: colors.danger + '40' },
  wardCardStripe: { width: 4, alignSelf: 'stretch' },
  wardCardName: { fontSize: 15, fontWeight: '700', color: colors.gray900, flex: 1, marginRight: spacing.sm },
  wardCardDx: { fontSize: 13, color: colors.gray500, marginTop: 1 },
  wardCardMeta: { fontSize: 11, color: colors.gray400, fontWeight: '500' },
  wardCardStatus: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  wardCardStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  wardCardArrow: { fontSize: 22, color: colors.gray300, paddingRight: spacing.md },

  emptyWard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xxxl, alignItems: 'center', ...shadow.sm },
  showMoreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  showMoreText: { fontSize: 13, fontWeight: '600', color: colors.primary },
})

const stat = StyleSheet.create({
  card: { width: '48%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'flex-start', ...shadow.sm },
  icon: { fontSize: 20, marginBottom: spacing.xs },
  number: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  label: { fontSize: 12, color: colors.gray500, fontWeight: '500', marginTop: 2 },
})

const qa = StyleSheet.create({
  wrap: { alignItems: 'center', width: '23%' },
  circle: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, ...shadow.sm },
  icon: { fontSize: 22 },
  label: { fontSize: 11, fontWeight: '700', color: colors.gray700, textAlign: 'center' },
})

const lock = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C1020', justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl },
  logo: { width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  logoText: { fontSize: 30, fontWeight: '800', color: colors.white },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: spacing.sm },
  sub: { fontSize: 15, color: colors.gray400, marginBottom: 52 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: 15, paddingHorizontal: 40, marginBottom: spacing.lg },
  btnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
