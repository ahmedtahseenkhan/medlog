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

function useDashboard() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [abnormalLabs, setAbnormalLabs] = useState(0)
  const [followUpsToday, setFollowUpsToday] = useState(0)
  const [nextAlarm, setNextAlarm] = useState<{ task: Task; patient: Patient | null } | null>(null)

  useEffect(() => {
    const patSub = database.get<Patient>('patients').query().observe().subscribe(async pts => {
      const now = Date.now()
      const sorted = [...pts].sort((a, b) => {
        if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
        if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1
        return (b.admissionDate ?? 0) - (a.admissionDate ?? 0)
      })
      setPatients(sorted)
      setFollowUpsToday(pts.filter(p => p.followUpDate != null && p.followUpDate <= now).length)
    })

    const taskSub = database.get<Task>('tasks').query(Q.where('status', Q.notEq('DONE'))).observe().subscribe(async tasks => {
      setPendingTasks(tasks)
      const now = Date.now()
      const upcoming = tasks.filter(t => t.dueAt && t.dueAt > now).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      if (upcoming.length > 0) {
        const t = upcoming[0]
        const patient = await database.get<Patient>('patients').find(t.patientId).catch(() => null)
        setNextAlarm({ task: t, patient })
      } else {
        setNextAlarm(null)
      }
    })

    const labSub = database.get<LabReport>('lab_reports')
      .query(Q.where('is_abnormal', true), Q.where('reported_at', Q.gte(Date.now() - 24 * 3_600_000)))
      .observe()
      .subscribe(labs => setAbnormalLabs(labs.length))

    return () => { patSub.unsubscribe(); taskSub.unsubscribe(); labSub.unsubscribe() }
  }, [])

  return {
    patients,
    admitted: patients.filter(p => p.status === 'ADMITTED').length,
    critical: patients.filter(p => p.status === 'CRITICAL').length,
    pendingTasks,
    abnormalLabs,
    followUpsToday,
    nextAlarm,
  }
}

function useCountdown(dueAt: number | null): string {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    if (!dueAt) { setDisplay(''); return }
    const update = () => {
      const diff = dueAt - Date.now()
      if (diff <= 0) { setDisplay('now'); return }
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

function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

export default function DashboardScreen() {
  const user = useAuthStore(s => s.user)
  const isGuest = useAuthStore(s => s.isGuest)
  const { locked, unlock, unlocking } = useSessionLock()
  const { patients, admitted, critical, pendingTasks, abnormalLabs, followUpsToday, nextAlarm } = useDashboard()
  const countdown = useCountdown(nextAlarm?.task.dueAt ?? null)
  const criticalPulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (critical === 0) return
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(criticalPulse, { toValue: 1.02, duration: 900, useNativeDriver: true }),
        Animated.timing(criticalPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
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
        <View style={lock.mark}><Text style={lock.markText}>M</Text></View>
        <Text style={lock.title}>MedLog AI</Text>
        <Text style={lock.sub}>Session locked</Text>
        <TouchableOpacity style={lock.btn} onPress={unlock} disabled={unlocking} activeOpacity={0.85}>
          <Text style={lock.btnText}>{unlocking ? 'Checking…' : 'Unlock with Biometrics'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => { await useAuthStore.getState().clearAuth(); router.replace('/(auth)/login') }} style={{ paddingVertical: spacing.md }}>
          <Text style={{ color: colors.textMid, fontSize: 14 }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const firstName = isGuest ? 'Doctor' : (user?.name ?? 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0]
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const activePatients = patients.filter(p => p.status !== 'DISCHARGED')

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />

      {/* ── Dark top bar ── */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{greet()}, Dr. {firstName}</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
        <TouchableOpacity
          style={styles.handoverPill}
          onPress={() => router.push('/(app)/handover' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.handoverPillText}>Handover</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Critical alert ── */}
        {critical > 0 && (
          <Animated.View style={[styles.criticalCard, { transform: [{ scale: criticalPulse }] }]}>
            <View style={styles.criticalDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.criticalTitle}>
                {critical} Critical Patient{critical > 1 ? 's' : ''} — Immediate Attention Required
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(app)/patients')} activeOpacity={0.8}>
              <Text style={styles.criticalLink}>View →</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Next alarm countdown ── */}
        {nextAlarm && (
          <TouchableOpacity style={styles.alarmCard} onPress={() => router.push('/(app)/tasks')} activeOpacity={0.85}>
            <View style={styles.alarmLeft}>
              <Text style={styles.alarmCountdown}>{countdown}</Text>
              <Text style={styles.alarmCountdownLabel}>until</Text>
            </View>
            <View style={styles.alarmDivider} />
            <View style={{ flex: 1, paddingLeft: spacing.lg }}>
              <Text style={styles.alarmTitle} numberOfLines={1}>{nextAlarm.task.title}</Text>
              <Text style={styles.alarmPatient}>
                {nextAlarm.patient?.name ?? `MR# ${nextAlarm.patient?.mrNumber}`}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <StatCell value={admitted} label="Admitted" onPress={() => router.push('/(app)/patients')} />
          <View style={styles.statDivider} />
          <StatCell value={critical} label="Critical" valueColor={critical > 0 ? colors.critical : undefined} onPress={() => router.push('/(app)/patients')} />
          <View style={styles.statDivider} />
          <StatCell value={pendingTasks.length} label="Tasks" onPress={() => router.push('/(app)/tasks')} />
          <View style={styles.statDivider} />
          <StatCell value={abnormalLabs} label="Abn. Labs" valueColor={abnormalLabs > 0 ? colors.abnormal : undefined} onPress={() => router.push('/(app)/notifications')} />
        </View>

        {/* ── Follow-up banner ── */}
        {followUpsToday > 0 && (
          <TouchableOpacity style={styles.followUpBar} onPress={() => router.push('/(app)/notifications')} activeOpacity={0.85}>
            <Text style={styles.followUpBarText}>
              {followUpsToday} follow-up{followUpsToday > 1 ? 's' : ''} overdue or due today
            </Text>
            <Text style={styles.followUpBarArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <Action label="Add Patient"   onPress={() => router.push('/(app)/patients/new')} />
            <Action label="Set Alarm"     onPress={() => router.push('/(app)/tasks/new')} />
            <Action label="Calculators"   onPress={() => router.push('/(app)/calculators' as any)} />
            <Action label="Handover"      onPress={() => router.push('/(app)/handover' as any)} />
          </View>
        </View>

        {/* ── Ward patients ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Ward  ({activePatients.length})</Text>
            {activePatients.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(app)/patients')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>All patients →</Text>
              </TouchableOpacity>
            )}
          </View>

          {activePatients.length === 0 ? (
            <View style={styles.emptyWard}>
              <Text style={styles.emptyWardTitle}>No active patients</Text>
              <Text style={styles.emptyWardBody}>Tap Add Patient to get started</Text>
            </View>
          ) : (
            <View style={styles.wardTable}>
              {activePatients.slice(0, 6).map((p, i) => {
                const isCritical = p.status === 'CRITICAL'
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.wardRow, i > 0 && styles.wardRowBorder, isCritical && styles.wardRowCritical]}
                    onPress={() => router.push(`/(app)/patients/${p.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.wardStripe, { backgroundColor: isCritical ? colors.critical : colors.stable }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.wardName, isCritical && { color: colors.critical }]} numberOfLines={1}>
                        {p.name ?? `MR# ${p.mrNumber}`}
                      </Text>
                      <Text style={styles.wardMeta} numberOfLines={1}>
                        {p.admissionDiagnosis ?? 'No diagnosis recorded'}
                        {p.wardId ? `  ·  Ward ${p.wardId}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.wardStatus, { color: isCritical ? colors.critical : colors.stable }]}>
                      {isCritical ? 'CRIT' : 'ADM'}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCell({ value, label, valueColor, onPress }: { value: number; label: string; valueColor?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={sc.cell} onPress={onPress} activeOpacity={0.7}>
      <Text style={[sc.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
    </TouchableOpacity>
  )
}
const sc = StyleSheet.create({
  cell: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  value: { ...typography.monoLarge, fontSize: 28, color: colors.text },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSoft, marginTop: spacing.xs, textAlign: 'center' },
})

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ac.btn} onPress={onPress} activeOpacity={0.75}>
      <Text style={ac.label}>{label}</Text>
    </TouchableOpacity>
  )
}
const ac = StyleSheet.create({
  btn: {
    width: '48%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
})

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },

  topBar: {
    backgroundColor: colors.ink,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.white, letterSpacing: -0.3 },
  date: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: spacing.xs },
  handoverPill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: 4,
  },
  handoverPillText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 },

  // ── Critical ──
  criticalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.criticalBg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.criticalBorder,
    gap: spacing.md,
  },
  criticalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.critical, flexShrink: 0 },
  criticalTitle: { fontSize: 13, fontWeight: '700', color: colors.critical, lineHeight: 18 },
  criticalLink: { fontSize: 13, fontWeight: '700', color: colors.critical },

  // ── Alarm ──
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.ink,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  alarmLeft: { alignItems: 'center', minWidth: 56 },
  alarmCountdown: { fontSize: 22, fontWeight: '800', color: '#A78BFA', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.5 },
  alarmCountdownLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  alarmDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: 'rgba(255,255,255,0.12)', marginLeft: spacing.md },
  alarmTitle: { fontSize: 14, fontWeight: '700', color: colors.white, marginBottom: 2 },
  alarmPatient: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },

  // ── Stats ──
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line },

  // ── Follow-up ──
  followUpBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.abnormalBg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.abnormalBorder,
  },
  followUpBarText: { fontSize: 13, fontWeight: '600', color: colors.abnormal },
  followUpBarArrow: { fontSize: 16, color: colors.abnormal, fontWeight: '700' },

  // ── Sections ──
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  // ── Ward table ──
  wardTable: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  wardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    backgroundColor: colors.white,
  },
  wardRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  wardRowCritical: { backgroundColor: '#FFFAFA' },
  wardStripe: { width: 3, alignSelf: 'stretch', marginRight: spacing.md, marginLeft: spacing.lg },
  wardName: { fontSize: 14, fontWeight: '700', color: colors.text },
  wardMeta: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  wardStatus: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginLeft: spacing.md },

  emptyWard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyWardTitle: { ...typography.h4, color: colors.textMid, marginBottom: spacing.xs },
  emptyWardBody: { ...typography.bodySmall, textAlign: 'center' },
})

const lock = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0F1E', justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl },
  mark: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  markText: { fontSize: 26, fontWeight: '800', color: colors.white },
  title: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  sub: { fontSize: 14, color: colors.textSoft, marginBottom: 48 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 36, marginBottom: spacing.lg },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
})
