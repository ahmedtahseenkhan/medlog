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
import { colors, spacing, radius, shadow } from '../../src/theme'

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
      } else setNextAlarm(null)
    })
    const labSub = database.get<LabReport>('lab_reports')
      .query(Q.where('is_abnormal', true), Q.where('reported_at', Q.gte(Date.now() - 24 * 3_600_000)))
      .observe().subscribe(labs => setAbnormalLabs(labs.length))
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
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardScreen() {
  const user = useAuthStore(s => s.user)
  const isGuest = useAuthStore(s => s.isGuest)
  const { locked, unlock, unlocking } = useSessionLock()
  const { patients, admitted, critical, pendingTasks, abnormalLabs, followUpsToday, nextAlarm } = useDashboard()
  const countdown = useCountdown(nextAlarm?.task.dueAt ?? null)
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (critical === 0) return
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.02, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]))
    anim.start()
    return () => anim.stop()
  }, [critical])

  if (locked) {
    return (
      <View style={lock.screen}>
        <StatusBar barStyle="light-content" />
        <View style={lock.logo}><Text style={lock.logoText}>M</Text></View>
        <Text style={lock.title}>MedLog AI</Text>
        <Text style={lock.sub}>Your session has been locked</Text>
        <TouchableOpacity style={lock.btn} onPress={unlock} disabled={unlocking} activeOpacity={0.85}>
          <Text style={lock.btnText}>{unlocking ? 'Checking…' : '🔓  Unlock'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={async () => { await useAuthStore.getState().clearAuth(); router.replace('/(auth)/login') }}>
          <Text style={{ color: colors.textSoft, fontSize: 14, paddingVertical: spacing.md }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const firstName = isGuest ? 'Doctor' : (user?.name ?? 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0]
  const activePatients = patients.filter(p => p.status !== 'DISCHARGED')

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
        {/* ── Teal header (sticky) ── */}
        <View style={s.header}>
          <View style={s.headerContent}>
            <View>
              <Text style={s.greeting}>{greet()},</Text>
              <Text style={s.doctorName}>Dr. {firstName}</Text>
            </View>
            <TouchableOpacity style={s.handoverBtn} onPress={() => router.push('/(app)/handover' as any)} activeOpacity={0.85}>
              <Text style={s.handoverBtnText}>⇄  Handover</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Critical alert ── */}
          {critical > 0 && (
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <TouchableOpacity style={s.criticalBanner} onPress={() => router.push('/(app)/patients')} activeOpacity={0.9}>
                <View style={s.criticalPulse} />
                <Text style={s.criticalText}>
                  {critical} critical patient{critical > 1 ? 's' : ''} — tap to view
                </Text>
                <Text style={s.criticalArrow}>›</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Next alarm ── */}
          {nextAlarm && (
            <TouchableOpacity style={s.alarmCard} onPress={() => router.push('/(app)/tasks')} activeOpacity={0.85}>
              <View style={s.alarmBadge}>
                <Text style={s.alarmBadgeText}>ALARM</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.alarmTask} numberOfLines={1}>{nextAlarm.task.title}</Text>
                <Text style={s.alarmPatient}>{nextAlarm.patient?.name ?? `MR# ${nextAlarm.patient?.mrNumber}`}</Text>
              </View>
              <View style={s.alarmCountdownWrap}>
                <Text style={s.alarmCountdown}>{countdown}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Stats ── */}
          <View style={s.statsCard}>
            <StatBox value={admitted} label="Admitted" color={colors.success} onPress={() => router.push('/(app)/patients')} />
            <View style={s.statDiv} />
            <StatBox value={critical} label="Critical" color={critical > 0 ? colors.critical : colors.textSoft} onPress={() => router.push('/(app)/patients')} />
            <View style={s.statDiv} />
            <StatBox value={pendingTasks.length} label="Tasks" color={pendingTasks.length > 0 ? colors.primary : colors.textSoft} onPress={() => router.push('/(app)/tasks')} />
            <View style={s.statDiv} />
            <StatBox value={abnormalLabs} label="Abn. Labs" color={abnormalLabs > 0 ? colors.warning : colors.textSoft} onPress={() => router.push('/(app)/notifications')} />
          </View>

          {/* ── Follow-ups ── */}
          {followUpsToday > 0 && (
            <TouchableOpacity style={s.followUpCard} onPress={() => router.push('/(app)/notifications')} activeOpacity={0.85}>
              <Text style={s.followUpText}>
                {followUpsToday} follow-up{followUpsToday > 1 ? 's' : ''} due or overdue today
              </Text>
              <Text style={s.followUpArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Quick actions ── */}
          <Text style={s.sectionLabel}>Quick Actions</Text>
          <View style={s.actionsGrid}>
            <ActionBtn label="Add Patient"  sub="Register new"   onPress={() => router.push('/(app)/patients/new')} />
            <ActionBtn label="Set Alarm"    sub="Task reminder"  onPress={() => router.push('/(app)/tasks/new')} />
            <ActionBtn label="Calculators"  sub="CrCl, CURB-65" onPress={() => router.push('/(app)/calculators' as any)} />
            <ActionBtn label="Antibiotics"  sub="Dosing guide"   onPress={() => router.push('/(app)/calculators/antibiotics' as any)} />
          </View>

          {/* ── Ward ── */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionLabel}>Ward ({activePatients.length})</Text>
            {activePatients.length > 5 && (
              <TouchableOpacity onPress={() => router.push('/(app)/patients')} activeOpacity={0.7}>
                <Text style={s.seeAll}>See all →</Text>
              </TouchableOpacity>
            )}
          </View>

          {activePatients.length === 0 ? (
            <View style={s.emptyWard}>
              <Text style={s.emptyWardText}>No active patients</Text>
              <Text style={s.emptyWardSub}>Tap "Add Patient" to get started</Text>
            </View>
          ) : (
            <View style={s.wardList}>
              {activePatients.slice(0, 6).map((p, i) => {
                const isCritical = p.status === 'CRITICAL'
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.wardItem, i > 0 && s.wardItemBorder]}
                    onPress={() => router.push(`/(app)/patients/${p.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[s.wardDot, { backgroundColor: isCritical ? colors.critical : colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.wardName, isCritical && { color: colors.critical }]} numberOfLines={1}>
                        {p.name ?? `MR# ${p.mrNumber}`}
                      </Text>
                      {p.admissionDiagnosis ? (
                        <Text style={s.wardDx} numberOfLines={1}>{p.admissionDiagnosis}</Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.wardStatus, { color: isCritical ? colors.critical : colors.success }]}>
                        {isCritical ? 'CRITICAL' : 'ADMITTED'}
                      </Text>
                      {p.wardId ? <Text style={s.wardMeta}>Ward {p.wardId}{p.bedNumber ? ` · ${p.bedNumber}` : ''}</Text> : null}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function StatBox({ value, label, color, onPress }: { value: number; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={sb.wrap} onPress={onPress} activeOpacity={0.7}>
      <Text style={[sb.value, { color }]}>{value}</Text>
      <Text style={sb.label}>{label}</Text>
    </TouchableOpacity>
  )
}
const sb = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: spacing.lg },
  value: { fontSize: 30, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] as any },
  label: { fontSize: 11, color: colors.textSoft, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center' },
})

function ActionBtn({ label, sub, onPress }: { label: string; sub: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={ab.btn} onPress={onPress} activeOpacity={0.8}>
      <Text style={ab.label}>{label}</Text>
      <Text style={ab.sub}>{sub}</Text>
    </TouchableOpacity>
  )
}
const ab = StyleSheet.create({
  btn: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.sm,
  },
  label: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 3 },
  sub: { fontSize: 12, color: colors.textSoft },
})

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.xxl,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  doctorName: { fontSize: 24, fontWeight: '800', color: colors.white, letterSpacing: -0.5, marginTop: 2 },
  handoverBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  handoverBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  body: { padding: spacing.lg, paddingBottom: 32, marginTop: -spacing.lg },

  // Critical
  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.criticalBg,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.criticalBorder,
    gap: spacing.md,
    ...shadow.sm,
  },
  criticalPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.critical },
  criticalText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.critical },
  criticalArrow: { fontSize: 20, color: colors.critical, fontWeight: '700' },

  // Alarm
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadow.md,
  },
  alarmBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  alarmBadgeText: { fontSize: 9, fontWeight: '800', color: colors.white, letterSpacing: 1 },
  alarmTask: { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 2 },
  alarmPatient: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  alarmCountdownWrap: { alignItems: 'center', minWidth: 48 },
  alarmCountdown: { fontSize: 24, fontWeight: '800', color: '#a78bfa', fontVariant: ['tabular-nums'] as any, letterSpacing: -0.5 },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.sm,
  },
  statDiv: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line },

  // Follow-up
  followUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  followUpText: { fontSize: 13, fontWeight: '600', color: colors.warning },
  followUpArrow: { fontSize: 18, color: colors.warning, fontWeight: '700' },

  // Sections
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textSoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.md, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: spacing.md },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },

  // Ward list
  wardList: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    ...shadow.sm,
  },
  wardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  wardItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  wardDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  wardName: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
  wardDx: { fontSize: 12, color: colors.textSoft },
  wardStatus: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  wardMeta: { fontSize: 11, color: colors.textSoft },

  emptyWard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyWardText: { fontSize: 15, fontWeight: '600', color: colors.textMid, marginBottom: spacing.xs },
  emptyWardSub: { fontSize: 13, color: colors.textSoft },
})

const lock = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A2F2B', justifyContent: 'center', alignItems: 'center', padding: spacing.xxxl },
  logo: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  logoText: { fontSize: 28, fontWeight: '800', color: colors.white },
  title: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: spacing.xs },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 48 },
  btn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 36, marginBottom: spacing.lg, ...shadow.md },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
})
