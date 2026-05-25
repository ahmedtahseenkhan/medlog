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
import type { Vitals } from '../../../src/db/models/Vitals'
import { Q } from '@nozbe/watermelondb'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

type Tab = 'timeline' | 'tasks' | 'labs' | 'vitals'

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: colors.critical, URGENT: '#7C3AED', MEDIUM: colors.warning, LOW: colors.textSoft,
}

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL:   { bg: colors.criticalBg,   text: colors.critical, dot: colors.critical },
  ADMITTED:   { bg: colors.successLight, text: colors.success,  dot: colors.success },
  DISCHARGED: { bg: colors.lineLight,    text: colors.textSoft, dot: colors.textSoft },
}

const VITAL_META: Record<string, { icon: string; label: string; unit: string }> = {
  bp:   { icon: '🩺', label: 'Blood Pressure', unit: 'mmHg' },
  hr:   { icon: '❤️', label: 'Heart Rate',     unit: 'bpm' },
  temp: { icon: '🌡️', label: 'Temperature',   unit: '°C' },
  spo2: { icon: '💨', label: 'SpO₂',           unit: '%' },
  rr:   { icon: '🌬️', label: 'Resp Rate',     unit: '/min' },
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
  const [vitals, setVitals] = useState<Vitals[]>([])
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
      .query(Q.where('patient_id', id)).observe().subscribe(setTasks)
    const labSub = database.get<LabReport>('lab_reports')
      .query(Q.where('patient_id', id)).observe().subscribe(setLabs)
    const vitalSub = database.get<Vitals>('vitals')
      .query(Q.where('patient_id', id)).observe().subscribe(setVitals)
    return () => { taskSub.unsubscribe(); labSub.unsubscribe(); vitalSub.unsubscribe() }
  }, [id])

  async function toggleTask(taskId: string, currentStatus: string) {
    const task = await database.get<Task>('tasks').find(taskId)
    await database.write(async () => {
      await task.update((t) => {
        t.status = currentStatus === 'DONE' ? 'PENDING' : 'DONE'
      })
    })
  }

  if (loading) {
    return <View style={s.loadingWrap}><ActivityIndicator color={colors.primary} size="large" /></View>
  }
  if (!patient) {
    return (
      <View style={s.loadingWrap}>
        <Text style={{ color: colors.textSoft }}>Patient not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const admissionDate = patient.admissionDate ? fmtDate(patient.admissionDate) : '—'
  const followUpDate = patient.followUpDate ? fmtDate(patient.followUpDate) : null
  const statusCfg = STATUS_CFG[patient.status] ?? STATUS_CFG.ADMITTED

  const pendingTasks = tasks.filter(t => t.status !== 'DONE').length
  const criticalLabs = labs.filter(l => l.isCritical).length

  const TABS: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'vitals',   label: `Vitals${vitals.length > 0 ? ` (${vitals.length})` : ''}` },
    { key: 'tasks',    label: `Tasks${pendingTasks > 0 ? ` (${pendingTasks})` : ''}` },
    { key: 'labs',     label: `Labs${labs.length > 0 ? ` (${labs.length})` : ''}` },
  ]

  type TimelineEvent =
    | { kind: 'task'; item: Task; ts: number }
    | { kind: 'lab'; item: LabReport; ts: number }

  const timeline: TimelineEvent[] = [
    ...tasks.map(t => ({ kind: 'task' as const, item: t, ts: t.createdAt?.getTime() ?? 0 })),
    ...labs.map(l => ({ kind: 'lab' as const, item: l, ts: l.reportedAt })),
  ].sort((a, b) => b.ts - a.ts)

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* ── Teal Hero ── */}
      <View style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backArrow}>{'<'}</Text>
          <Text style={s.backLabel}>Patients</Text>
        </TouchableOpacity>

        <View style={s.heroTitleRow}>
          <View style={{ flex: 1 }}>
            {patient.name ? <Text style={s.heroName}>{patient.name}</Text> : null}
            <Text style={s.heroMR}>MR# {patient.mrNumber}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <View style={[s.statusDot, { backgroundColor: statusCfg.dot }]} />
            <Text style={[s.statusText, { color: statusCfg.text }]}>{patient.status}</Text>
          </View>
        </View>

        {patient.admissionDiagnosis ? (
          <Text style={s.heroDx} numberOfLines={2}>{patient.admissionDiagnosis}</Text>
        ) : null}

        {/* Info pills row */}
        <View style={s.infoPills}>
          {[
            { label: 'Ward',     value: patient.wardId ?? '—' },
            { label: 'Bed',      value: patient.bedNumber ?? '—' },
            { label: 'Admitted', value: admissionDate },
          ].map(({ label, value }) => (
            <View key={label} style={s.infoPill}>
              <Text style={s.infoPillLabel}>{label}</Text>
              <Text style={s.infoPillValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Stats chips */}
        <View style={s.statsRow}>
          {pendingTasks > 0 && (
            <View style={[s.statChip, { backgroundColor: 'rgba(217,119,6,0.2)' }]}>
              <Text style={[s.statChipText, { color: '#FCD34D' }]}>✓ {pendingTasks} task{pendingTasks > 1 ? 's' : ''}</Text>
            </View>
          )}
          {criticalLabs > 0 && (
            <View style={[s.statChip, { backgroundColor: 'rgba(220,38,38,0.2)' }]}>
              <Text style={[s.statChipText, { color: '#FCA5A5' }]}>⚠ {criticalLabs} critical lab{criticalLabs > 1 ? 's' : ''}</Text>
            </View>
          )}
          {followUpDate && (
            <View style={[s.statChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={[s.statChipText, { color: 'rgba(255,255,255,0.9)' }]}>📅 {followUpDate}</Text>
            </View>
          )}
          {patient.phone && (
            <View style={[s.statChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={[s.statChipText, { color: 'rgba(255,255,255,0.9)' }]}>📞 {patient.phone}</Text>
            </View>
          )}
        </View>

        {/* Logbook button */}
        <TouchableOpacity
          style={s.logbookBtn}
          onPress={() => router.push(`/(app)/patients/logbook?patientId=${id}` as any)}
          activeOpacity={0.85}
        >
          <Text style={s.logbookBtnText}>📋  Case Logbook & Export</Text>
        </TouchableOpacity>
      </View>

      {/* ── Tab Bar ── */}
      <View style={s.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, activeTab === t.key && s.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Tab Content ── */}
      <ScrollView style={s.content} contentContainerStyle={s.contentInner} showsVerticalScrollIndicator={false}>

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <View>
            <View style={tl.actions}>
              <TouchableOpacity style={[tl.actionBtn, { backgroundColor: colors.success }]}
                onPress={() => router.push(`/(app)/tasks/new?patientId=${id}` as any)} activeOpacity={0.85}>
                <Text style={tl.actionBtnText}>+ Task</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[tl.actionBtn, { backgroundColor: '#7C3AED' }]}
                onPress={() => router.push(`/(app)/patients/add-lab?patientId=${id}` as any)} activeOpacity={0.85}>
                <Text style={tl.actionBtnText}>+ Lab</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[tl.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push(`/(app)/patients/add-vitals?patientId=${id}` as any)} activeOpacity={0.85}>
                <Text style={tl.actionBtnText}>+ Vitals</Text>
              </TouchableOpacity>
            </View>

            {timeline.length === 0 ? (
              <EmptyState icon="📋" text="No activity yet" sub="Add tasks or lab results to track this patient" />
            ) : (
              timeline.map((ev, i) => (
                <View key={`${ev.kind}-${ev.item.id}-${i}`} style={tl.row}>
                  <View style={tl.iconCol}>
                    <View style={[tl.iconCircle, ev.kind === 'lab' && { backgroundColor: '#EDE9FE' }]}>
                      <Text style={tl.iconText}>{ev.kind === 'task' ? '✓' : '🧪'}</Text>
                    </View>
                    {i < timeline.length - 1 && <View style={tl.line} />}
                  </View>
                  <View style={tl.card}>
                    {ev.kind === 'task' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[tl.text, ev.item.status === 'DONE' && tl.done]} numberOfLines={2}>{ev.item.title}</Text>
                        <View style={[tl.priorityBadge, { borderColor: PRIORITY_COLOR[ev.item.priority] ?? colors.line }]}>
                          <Text style={[tl.priorityText, { color: PRIORITY_COLOR[ev.item.priority] ?? colors.textSoft }]}>{ev.item.priority}</Text>
                        </View>
                      </View>
                    )}
                    {ev.kind === 'lab' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={tl.text}>{ev.item.testName}</Text>
                        <Text style={[tl.labValue, ev.item.isCritical ? { color: colors.critical } : ev.item.isAbnormal ? { color: colors.warning } : {}]}>
                          {ev.item.value} {ev.item.unit}
                          {ev.item.isCritical ? ' ⚠️' : ev.item.isAbnormal ? ' ↑' : ''}
                        </Text>
                      </View>
                    )}
                    <Text style={tl.time}>{fmt(ev.ts)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TASKS */}
        {activeTab === 'tasks' && (
          <View>
            <TouchableOpacity style={sh.addBtn} onPress={() => router.push(`/(app)/tasks/new?patientId=${id}` as any)} activeOpacity={0.85}>
              <Text style={sh.addBtnText}>+ Add Task</Text>
            </TouchableOpacity>
            {tasks.length === 0 ? (
              <EmptyState icon="✅" text="No tasks yet" sub="Add tasks to track actions for this patient" />
            ) : (
              <>
                {tasks.filter(t => t.status !== 'DONE').length > 0 && (
                  <>
                    <Text style={sh.groupLabel}>PENDING</Text>
                    {tasks.filter(t => t.status !== 'DONE').map(task => (
                      <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id, task.status)} />
                    ))}
                  </>
                )}
                {tasks.filter(t => t.status === 'DONE').length > 0 && (
                  <>
                    <Text style={[sh.groupLabel, { marginTop: spacing.lg }]}>COMPLETED</Text>
                    {tasks.filter(t => t.status === 'DONE').map(task => (
                      <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id, task.status)} />
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* VITALS */}
        {activeTab === 'vitals' && <VitalsTab vitals={vitals} patientId={id!} />}

        {/* LABS */}
        {activeTab === 'labs' && (
          <View>
            <TouchableOpacity style={sh.addBtn} onPress={() => router.push(`/(app)/patients/add-lab?patientId=${id}` as any)} activeOpacity={0.85}>
              <Text style={sh.addBtnText}>+ Add Lab Result</Text>
            </TouchableOpacity>
            {labs.length === 0 ? (
              <EmptyState icon="🧪" text="No lab results yet" sub="Add lab results to track test values and get abnormal alerts" />
            ) : (
              [...labs].sort((a, b) => b.reportedAt - a.reportedAt).map(lab => {
                const prev = labs
                  .filter(l => l.testName === lab.testName && l.reportedAt < lab.reportedAt)
                  .sort((a, b) => b.reportedAt - a.reportedAt)[0]
                const prevVal = prev ? parseFloat(prev.value) : null
                const curVal = parseFloat(lab.value)
                const trendIcon = prevVal === null ? null : curVal > prevVal ? '↑' : curVal < prevVal ? '↓' : '→'
                const trendColor = prevVal === null ? null : curVal > prevVal ? colors.critical : curVal < prevVal ? colors.success : colors.textSoft
                const valueColor = lab.isCritical ? colors.critical : lab.isAbnormal ? colors.warning : colors.text

                return (
                  <View key={lab.id} style={[lb.card, lab.isCritical && lb.critCard, lab.isAbnormal && !lab.isCritical && lb.abnCard]}>
                    <View style={lb.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={lb.testName}>{lab.testName}</Text>
                        {lab.referenceRangeLow != null && lab.referenceRangeHigh != null ? (
                          <Text style={lb.refRange}>Normal: {lab.referenceRangeLow}–{lab.referenceRangeHigh} {lab.unit}</Text>
                        ) : null}
                        <Text style={lb.date}>{fmt(lab.reportedAt)}</Text>
                      </View>
                      <View style={lb.valueWrap}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                          <Text style={[lb.value, { color: valueColor }]}>{lab.value}</Text>
                          {trendIcon && <Text style={{ fontSize: 18, fontWeight: '800', color: trendColor ?? colors.textSoft }}>{trendIcon}</Text>}
                        </View>
                        <Text style={lb.unit}>{lab.unit}</Text>
                        {lab.isCritical && (
                          <View style={[lb.flagBadge, { backgroundColor: colors.criticalBg }]}>
                            <Text style={[lb.flagText, { color: colors.critical }]}>CRITICAL</Text>
                          </View>
                        )}
                        {lab.isAbnormal && !lab.isCritical && (
                          <View style={[lb.flagBadge, { backgroundColor: colors.warningLight }]}>
                            <Text style={[lb.flagText, { color: colors.warning }]}>ABNORMAL</Text>
                          </View>
                        )}
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

// ─── Vitals Tab ───────────────────────────────────────────────────────────────

function VitalsTab({ vitals, patientId }: { vitals: Vitals[]; patientId: string }) {
  const sorted = [...vitals].sort((a, b) => b.recordedAt - a.recordedAt)

  function trend(key: keyof Vitals, current: Vitals): { arrow: string; color: string } | null {
    const prev = sorted.find(v => v.id !== current.id && v.recordedAt < current.recordedAt)
    if (!prev) return null
    const cur = current[key] as number | null
    const pre = prev[key] as number | null
    if (cur == null || pre == null) return null
    if (cur > pre) return { arrow: '↑', color: colors.critical }
    if (cur < pre) return { arrow: '↓', color: colors.success }
    return { arrow: '→', color: colors.textSoft }
  }

  function isCrit(key: string, val: number | null): boolean {
    if (val == null) return false
    const thresholds: Record<string, { low?: number; high?: number }> = {
      spo2: { low: 94 }, heartRate: { low: 40, high: 130 },
      temperature: { low: 35, high: 39.5 }, respiratoryRate: { low: 8, high: 30 },
      bpSystolic: { low: 90, high: 180 },
    }
    const t = thresholds[key]
    if (!t) return false
    return (t.low !== undefined && val < t.low) || (t.high !== undefined && val > t.high)
  }

  return (
    <View>
      <TouchableOpacity style={sh.addBtn} onPress={() => router.push(`/(app)/patients/add-vitals?patientId=${patientId}` as any)} activeOpacity={0.85}>
        <Text style={sh.addBtnText}>+ Record Vitals Now</Text>
      </TouchableOpacity>

      {sorted.length === 0 ? (
        <EmptyState icon="💓" text="No vitals recorded" sub="Tap above to record BP, HR, Temp, SpO₂" />
      ) : (
        sorted.map(v => (
          <View key={v.id} style={vt.card}>
            <Text style={vt.time}>{fmt(v.recordedAt)}</Text>
            <View style={vt.grid}>

              {/* BP — spans if available */}
              {v.bpSystolic != null && v.bpDiastolic != null && (
                <View style={[vt.cell, isCrit('bpSystolic', v.bpSystolic) ? vt.cellCritical : vt.cellNormal]}>
                  <View style={vt.cellTop}>
                    <Text style={vt.cellIcon}>🩺</Text>
                    {trend('bpSystolic', v) && (
                      <Text style={[vt.trend, { color: trend('bpSystolic', v)!.color }]}>{trend('bpSystolic', v)!.arrow}</Text>
                    )}
                  </View>
                  <Text style={[vt.cellValue, isCrit('bpSystolic', v.bpSystolic) && vt.cellValueCrit]}>
                    {v.bpSystolic}/{v.bpDiastolic}
                  </Text>
                  <Text style={vt.cellLabel}>Blood Pressure</Text>
                  <Text style={vt.cellUnit}>mmHg</Text>
                </View>
              )}

              {v.heartRate != null && (
                <View style={[vt.cell, isCrit('heartRate', v.heartRate) ? vt.cellCritical : vt.cellNormal]}>
                  <View style={vt.cellTop}>
                    <Text style={vt.cellIcon}>❤️</Text>
                    {trend('heartRate', v) && (
                      <Text style={[vt.trend, { color: trend('heartRate', v)!.color }]}>{trend('heartRate', v)!.arrow}</Text>
                    )}
                  </View>
                  <Text style={[vt.cellValue, isCrit('heartRate', v.heartRate) && vt.cellValueCrit]}>{v.heartRate}</Text>
                  <Text style={vt.cellLabel}>Heart Rate</Text>
                  <Text style={vt.cellUnit}>bpm</Text>
                </View>
              )}

              {v.temperature != null && (
                <View style={[vt.cell, isCrit('temperature', v.temperature) ? vt.cellCritical : vt.cellNormal]}>
                  <View style={vt.cellTop}>
                    <Text style={vt.cellIcon}>🌡️</Text>
                    {trend('temperature', v) && (
                      <Text style={[vt.trend, { color: trend('temperature', v)!.color }]}>{trend('temperature', v)!.arrow}</Text>
                    )}
                  </View>
                  <Text style={[vt.cellValue, isCrit('temperature', v.temperature) && vt.cellValueCrit]}>{v.temperature}</Text>
                  <Text style={vt.cellLabel}>Temperature</Text>
                  <Text style={vt.cellUnit}>°C</Text>
                </View>
              )}

              {v.spo2 != null && (
                <View style={[vt.cell, isCrit('spo2', v.spo2) ? vt.cellCritical : vt.cellNormal]}>
                  <View style={vt.cellTop}>
                    <Text style={vt.cellIcon}>💨</Text>
                    {trend('spo2', v) && (
                      <Text style={[vt.trend, { color: trend('spo2', v)!.color }]}>{trend('spo2', v)!.arrow}</Text>
                    )}
                  </View>
                  <Text style={[vt.cellValue, isCrit('spo2', v.spo2) && vt.cellValueCrit]}>{v.spo2}</Text>
                  <Text style={vt.cellLabel}>SpO₂</Text>
                  <Text style={vt.cellUnit}>%</Text>
                </View>
              )}

              {v.respiratoryRate != null && (
                <View style={[vt.cell, isCrit('respiratoryRate', v.respiratoryRate) ? vt.cellCritical : vt.cellNormal]}>
                  <View style={vt.cellTop}>
                    <Text style={vt.cellIcon}>🌬️</Text>
                    {trend('respiratoryRate', v) && (
                      <Text style={[vt.trend, { color: trend('respiratoryRate', v)!.color }]}>{trend('respiratoryRate', v)!.arrow}</Text>
                    )}
                  </View>
                  <Text style={[vt.cellValue, isCrit('respiratoryRate', v.respiratoryRate) && vt.cellValueCrit]}>{v.respiratoryRate}</Text>
                  <Text style={vt.cellLabel}>Resp Rate</Text>
                  <Text style={vt.cellUnit}>/min</Text>
                </View>
              )}
            </View>
            {v.notes ? <Text style={vt.notes}>{v.notes}</Text> : null}
          </View>
        ))
      )}
    </View>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function TaskRow({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const color = PRIORITY_COLOR[task.priority] ?? colors.textSoft
  const isDone = task.status === 'DONE'
  return (
    <View style={[tk.card, { borderLeftColor: color }]}>
      <View style={{ flex: 1 }}>
        <Text style={[tk.title, isDone && tk.done]}>{task.title}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <View style={[tk.pill, { borderColor: color }]}>
            <Text style={[tk.pillText, { color }]}>{task.priority}</Text>
          </View>
          {task.dueAt ? <Text style={tk.due}>Due {fmtDate(task.dueAt)}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={[tk.check, isDone && tk.checkDone]} onPress={onToggle} activeOpacity={0.75}>
        {isDone && <Text style={tk.checkMark}>✓</Text>}
      </TouchableOpacity>
    </View>
  )
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48 }}>
      <Text style={{ fontSize: 36, marginBottom: spacing.md, opacity: 0.35 }}>{icon}</Text>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.xs }}>{text}</Text>
      {sub ? <Text style={{ fontSize: 13, color: colors.textSoft, textAlign: 'center', paddingHorizontal: spacing.xxl, lineHeight: 18 }}>{sub}</Text> : null}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const vt = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.md },
  time: { fontSize: 11, fontWeight: '700', color: colors.textSoft, marginBottom: spacing.md, letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  cell: { width: '47%', borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
  cellNormal: { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' },
  cellCritical: { backgroundColor: colors.criticalBg, borderColor: colors.criticalBorder },

  cellTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cellIcon: { fontSize: 20 },
  trend: { fontSize: 16, fontWeight: '800' },
  cellValue: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  cellValueCrit: { color: colors.critical },
  cellLabel: { fontSize: 11, fontWeight: '700', color: colors.textMid, marginTop: 2 },
  cellUnit: { fontSize: 10, color: colors.textSoft, marginTop: 1 },
  notes: { fontSize: 13, color: colors.textSoft, fontStyle: 'italic', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
})

const tl = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  actionBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', ...shadow.sm },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  iconCol: { width: 40, alignItems: 'center' },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 14 },
  line: { flex: 1, width: 1.5, backgroundColor: colors.line, marginTop: spacing.xs, marginBottom: -spacing.sm },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginLeft: spacing.sm, marginBottom: spacing.xs, ...shadow.sm },
  text: { fontSize: 14, color: colors.textMid, flex: 1, marginRight: spacing.sm },
  done: { textDecorationLine: 'line-through', color: colors.textSoft },
  time: { fontSize: 11, color: colors.textSoft, marginTop: spacing.xs },
  labValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  priorityBadge: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  priorityText: { fontSize: 11, fontWeight: '700' },
})

const tk = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, ...shadow.sm },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  done: { textDecorationLine: 'line-through', color: colors.textSoft },
  pill: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700' },
  due: { fontSize: 12, color: colors.textSoft, alignSelf: 'center' },
  check: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: colors.line, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.lg },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 14, color: colors.white, fontWeight: '700' },
})

const lb = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.line, ...shadow.sm },
  critCard: { borderLeftColor: colors.critical },
  abnCard: { borderLeftColor: colors.warning },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  testName: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 3 },
  refRange: { fontSize: 12, color: colors.textSoft },
  date: { fontSize: 11, color: colors.textSoft, marginTop: 4 },
  valueWrap: { alignItems: 'flex-end' },
  value: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 12, color: colors.textMid, marginTop: 2 },
  flagBadge: { borderRadius: radius.xs, paddingHorizontal: spacing.sm, paddingVertical: 2, marginTop: 4 },
  flagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
})

const sh = StyleSheet.create({
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg, ...shadow.sm },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  groupLabel: { fontSize: 11, fontWeight: '800', color: colors.textSoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
})

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

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
  heroName: { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 2, letterSpacing: -0.3 },
  heroMR: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },

  heroDx: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 20, marginBottom: spacing.md },

  infoPills: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  infoPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm },
  infoPillLabel: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  infoPillValue: { fontSize: 13, fontWeight: '700', color: colors.white },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  statChip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statChipText: { fontSize: 12, fontWeight: '700' },

  logbookBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  logbookBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  tabBarWrap: { backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  tabBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: 'transparent' },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: { padding: spacing.xxl, paddingBottom: 48 },
})
