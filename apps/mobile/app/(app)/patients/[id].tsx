import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import type { Task } from '../../../src/db/models/Task'
import type { LabReport } from '../../../src/db/models/LabReport'
import { Q } from '@nozbe/watermelondb'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

type Tab = 'timeline' | 'tasks' | 'labs'

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: colors.danger, URGENT: '#7C3AED', MEDIUM: colors.warning, LOW: colors.gray400,
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('timeline')
  const [patient, setPatient] = useState<Patient | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [labs, setLabs] = useState<LabReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    database.get<Patient>('patients').find(id)
      .then(setPatient)
      .catch(() => setPatient(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    const taskSub = database.get<Task>('tasks')
      .query(Q.where('patient_id', id))
      .observe()
      .subscribe(setTasks)
    const labSub = database.get<LabReport>('lab_reports')
      .query(Q.where('patient_id', id))
      .observe()
      .subscribe(setLabs)
    return () => { taskSub.unsubscribe(); labSub.unsubscribe() }
  }, [id])

  async function toggleTask(taskId: string, currentStatus: string) {
    await database.write(async () => {
      const task = await database.get<Task>('tasks').find(taskId)
      await task.update((t) => {
        t.status = currentStatus === 'DONE' ? 'PENDING' : 'DONE'
      })
    })
  }

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} size="large" /></View>
  }
  if (!patient) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={{ color: colors.gray500 }}>Patient not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const admissionDate = patient.admissionDate ? fmtDate(patient.admissionDate) : '—'
  const followUpDate = patient.followUpDate ? fmtDate(patient.followUpDate) : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'tasks', label: `Tasks${tasks.filter(t => t.status !== 'DONE').length > 0 ? ` (${tasks.filter(t => t.status !== 'DONE').length})` : ''}` },
    { key: 'labs', label: `Labs${labs.length > 0 ? ` (${labs.length})` : ''}` },
  ]

  // Timeline: merge tasks + labs sorted by date desc
  type TimelineEvent =
    | { kind: 'task'; item: Task; ts: number }
    | { kind: 'lab'; item: LabReport; ts: number }

  const timeline: TimelineEvent[] = [
    ...tasks.map(t => ({ kind: 'task' as const, item: t, ts: t.createdAt?.getTime() ?? 0 })),
    ...labs.map(l => ({ kind: 'lab' as const, item: l, ts: l.reportedAt })),
  ].sort((a, b) => b.ts - a.ts)

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Hero Header */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'<'}</Text>
          <Text style={styles.backLabel}>Patients</Text>
        </TouchableOpacity>

        <View style={styles.heroTitleRow}>
          <View style={{ flex: 1 }}>
            {patient.name ? <Text style={styles.heroName}>{patient.name}</Text> : null}
            <Text style={styles.heroMR}>MR# {patient.mrNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: patient.status === 'CRITICAL' ? colors.danger : patient.status === 'ADMITTED' ? colors.success : colors.gray400 }]}>
            <Text style={styles.statusBadgeText}>{patient.status}</Text>
          </View>
        </View>

        {patient.admissionDiagnosis ? (
          <Text style={styles.heroDx} numberOfLines={2}>{patient.admissionDiagnosis}</Text>
        ) : null}

        {/* Info pills */}
        <View style={styles.infoPills}>
          {[
            { label: 'Ward', value: patient.wardId ?? '—' },
            { label: 'Bed', value: patient.bedNumber ?? '—' },
            { label: 'Admitted', value: admissionDate },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoPill}>
              <Text style={styles.infoPillLabel}>{label}</Text>
              <Text style={styles.infoPillValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Follow-up banner */}
        {followUpDate && (
          <View style={styles.followUpBanner}>
            <Text style={styles.followUpText}>⏰ Follow-up: {followUpDate}</Text>
            {patient.followUpNotes ? <Text style={styles.followUpNotes}>{patient.followUpNotes}</Text> : null}
          </View>
        )}

        {/* Phone */}
        {patient.phone ? (
          <Text style={styles.phone}>📞 {patient.phone}</Text>
        ) : null}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <View>
            <View style={tlStyles.actions}>
              <TouchableOpacity style={[tlStyles.actionBtn, { backgroundColor: colors.success }]} onPress={() => router.push(`/(app)/tasks/new?patientId=${id}` as any)} activeOpacity={0.85}>
                <Text style={tlStyles.actionBtnText}>+ Task</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[tlStyles.actionBtn, { backgroundColor: '#7C3AED' }]} onPress={() => router.push(`/(app)/patients/add-lab?patientId=${id}` as any)} activeOpacity={0.85}>
                <Text style={tlStyles.actionBtnText}>+ Lab</Text>
              </TouchableOpacity>
            </View>

            {timeline.length === 0 ? (
              <EmptyState icon="📋" text="No activity yet" sub="Add tasks or lab results to track this patient" />
            ) : (
              timeline.map((ev, i) => (
                <View key={`${ev.kind}-${ev.kind === 'task' ? ev.item.id : ev.item.id}-${i}`} style={tlStyles.row}>
                  <View style={tlStyles.iconCol}>
                    <Text style={tlStyles.icon}>{ev.kind === 'task' ? '✓' : '🧪'}</Text>
                    {i < timeline.length - 1 && <View style={tlStyles.line} />}
                  </View>
                  <View style={tlStyles.card}>
                    {ev.kind === 'task' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[tlStyles.text, ev.item.status === 'DONE' && tlStyles.done]} numberOfLines={2}>{ev.item.title}</Text>
                        <View style={[tlStyles.priorityBadge, { borderColor: PRIORITY_COLOR[ev.item.priority] ?? colors.gray300 }]}>
                          <Text style={[tlStyles.priorityText, { color: PRIORITY_COLOR[ev.item.priority] ?? colors.gray400 }]}>{ev.item.priority}</Text>
                        </View>
                      </View>
                    )}
                    {ev.kind === 'lab' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={tlStyles.text}>{ev.item.testName}</Text>
                        <Text style={[tlStyles.labValue, ev.item.isCritical ? { color: colors.danger } : ev.item.isAbnormal ? { color: colors.warning } : {}]}>
                          {ev.item.value} {ev.item.unit}
                          {ev.item.isCritical ? ' ⚠️' : ev.item.isAbnormal ? ' ↑' : ''}
                        </Text>
                      </View>
                    )}
                    <Text style={tlStyles.time}>{fmt(ev.ts)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TASKS */}
        {activeTab === 'tasks' && (
          <View>
            <TouchableOpacity style={sharedStyles.addBtn} onPress={() => router.push(`/(app)/tasks/new?patientId=${id}` as any)} activeOpacity={0.85}>
              <Text style={sharedStyles.addBtnText}>+ Add Task</Text>
            </TouchableOpacity>

            {tasks.length === 0 ? (
              <EmptyState icon="✅" text="No tasks yet" sub="Add tasks to track actions for this patient" />
            ) : (
              <>
                {tasks.filter(t => t.status !== 'DONE').length > 0 && (
                  <>
                    <Text style={sharedStyles.groupLabel}>PENDING</Text>
                    {tasks.filter(t => t.status !== 'DONE').map(task => (
                      <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id, task.status)} />
                    ))}
                  </>
                )}
                {tasks.filter(t => t.status === 'DONE').length > 0 && (
                  <>
                    <Text style={[sharedStyles.groupLabel, { marginTop: spacing.lg }]}>COMPLETED</Text>
                    {tasks.filter(t => t.status === 'DONE').map(task => (
                      <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id, task.status)} />
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* LABS */}
        {activeTab === 'labs' && (
          <View>
            <TouchableOpacity style={sharedStyles.addBtn} onPress={() => router.push(`/(app)/patients/add-lab?patientId=${id}` as any)} activeOpacity={0.85}>
              <Text style={sharedStyles.addBtnText}>+ Add Lab Result</Text>
            </TouchableOpacity>

            {labs.length === 0 ? (
              <EmptyState icon="🧪" text="No lab results yet" sub="Add lab results to track test values and get abnormal alerts" />
            ) : (
              [...labs].sort((a, b) => b.reportedAt - a.reportedAt).map(lab => {
                const valueColor = lab.isCritical ? colors.danger : lab.isAbnormal ? colors.warning : colors.gray900
                return (
                  <View key={lab.id} style={[labStyles.card, lab.isCritical && labStyles.critCard, lab.isAbnormal && !lab.isCritical && labStyles.abnCard]}>
                    <View style={labStyles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={labStyles.testName}>{lab.testName}</Text>
                        {lab.referenceRangeLow != null && lab.referenceRangeHigh != null ? (
                          <Text style={labStyles.refRange}>Normal: {lab.referenceRangeLow}–{lab.referenceRangeHigh} {lab.unit}</Text>
                        ) : null}
                        <Text style={labStyles.date}>{fmt(lab.reportedAt)}</Text>
                      </View>
                      <View style={labStyles.valueWrap}>
                        <Text style={[labStyles.value, { color: valueColor }]}>{lab.value}</Text>
                        <Text style={labStyles.unit}>{lab.unit}</Text>
                        {lab.isCritical && <Text style={labStyles.critTag}>CRITICAL</Text>}
                        {lab.isAbnormal && !lab.isCritical && <Text style={labStyles.abnTag}>ABNORMAL</Text>}
                      </View>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const color = PRIORITY_COLOR[task.priority] ?? colors.gray400
  const isDone = task.status === 'DONE'
  return (
    <View style={[taskStyles.card, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={[taskStyles.title, isDone && taskStyles.done]}>{task.title}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={[taskStyles.pill, { borderColor: color }]}>
            <Text style={[taskStyles.pillText, { color }]}>{task.priority}</Text>
          </View>
          {task.dueAt ? <Text style={taskStyles.due}>Due {fmtDate(task.dueAt)}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={[taskStyles.check, isDone && taskStyles.checkDone]} onPress={onToggle} activeOpacity={0.75}>
        {isDone && <Text style={taskStyles.checkMark}>✓</Text>}
      </TouchableOpacity>
    </View>
  )
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Text style={{ fontSize: 36, marginBottom: spacing.md, opacity: 0.35 }}>{icon}</Text>
      <Text style={{ ...typography.h4, marginBottom: spacing.xs }}>{text}</Text>
      {sub ? <Text style={{ ...typography.bodySmall, textAlign: 'center', paddingHorizontal: spacing.xxl }}>{sub}</Text> : null}
    </View>
  )
}

const sharedStyles = StyleSheet.create({
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg, ...shadow.sm },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  groupLabel: { ...typography.label, marginBottom: spacing.sm },
})

const tlStyles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  actionBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', ...shadow.sm },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  iconCol: { width: 40, alignItems: 'center' },
  icon: { fontSize: 18, marginTop: 2 },
  line: { flex: 1, width: 1, backgroundColor: colors.gray200, marginTop: spacing.xs },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginLeft: spacing.sm, marginBottom: spacing.xs, ...shadow.sm },
  text: { fontSize: 14, color: colors.gray700, flex: 1, marginRight: spacing.sm },
  done: { textDecorationLine: 'line-through', color: colors.gray400 },
  time: { fontSize: 11, color: colors.gray400, marginTop: spacing.sm },
  labValue: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  priorityBadge: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  priorityText: { fontSize: 11, fontWeight: '700' },
})

const taskStyles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, ...shadow.sm },
  title: { fontSize: 15, fontWeight: '500', color: colors.gray900 },
  done: { textDecorationLine: 'line-through', color: colors.gray400 },
  pill: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700' },
  due: { fontSize: 12, color: colors.gray400 },
  check: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: colors.gray300, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.lg },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 14, color: colors.white, fontWeight: '700' },
})

const labStyles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.gray200, ...shadow.sm },
  critCard: { borderLeftColor: colors.danger },
  abnCard: { borderLeftColor: colors.warning },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  testName: { fontSize: 15, fontWeight: '600', color: colors.gray900, marginBottom: 2 },
  refRange: { fontSize: 12, color: colors.gray400 },
  date: { fontSize: 11, color: colors.gray400, marginTop: 4 },
  valueWrap: { alignItems: 'flex-end' },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  critTag: { fontSize: 10, fontWeight: '800', color: colors.danger, letterSpacing: 0.5, marginTop: 4 },
  abnTag: { fontSize: 10, fontWeight: '800', color: colors.warning, letterSpacing: 0.5, marginTop: 4 },
})

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.screenBg },

  hero: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  backArrow: { fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  backLabel: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  heroTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 2 },
  heroMR: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: 2 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  heroDx: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 20, marginBottom: spacing.md },
  infoPills: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  infoPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm },
  infoPillLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  infoPillValue: { fontSize: 13, fontWeight: '700', color: colors.white },
  followUpBanner: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  followUpText: { fontSize: 13, fontWeight: '700', color: colors.white },
  followUpNotes: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  phone: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  tabBarWrap: { backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  tabBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'transparent' },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: { padding: spacing.xxl, paddingBottom: 48 },
})
