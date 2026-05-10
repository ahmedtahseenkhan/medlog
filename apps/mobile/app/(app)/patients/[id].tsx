import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar, FlatList,
  TextInput, Modal,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import type { Patient, Task, ClinicalNote } from '../../../src/types'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'timeline' | 'notes' | 'tasks' | 'labs' | 'meds' | 'ddx' | 'rx'

interface Prescription {
  id: string; drugs: {name: string; dose: string; route: string; frequency: string; duration: string}[]
  notes?: string; hash: string; createdAt: string; revokedAt?: string; verifiedAt?: string
}

interface LabReport {
  id: string; testName: string; value: string; unit: string
  referenceRangeLow: number | null; referenceRangeHigh: number | null
  isAbnormal: boolean; isCritical: boolean; reportedAt: string
}
interface Medication {
  id: string; drugName: string; dose: string; route: string
  frequency: string; startDate: string; endDate?: string; isPrn: boolean
}
interface DdxResult {
  diagnosis: string; probability: number; reasoning: string
}

interface RecallRule {
  id: string; intervalDays: number; nextDueAt: string; diagnosisNote?: string; active: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  ADMITTED: colors.success, DISCHARGED: colors.gray400, ARCHIVED: colors.gray400,
}
const PRIORITY_COLOR: Record<string, string> = {
  HIGH: colors.danger, URGENT: '#7C3AED', MEDIUM: colors.warning, LOW: colors.gray400,
}
const NOTE_TYPE_COLOR: Record<string, string> = {
  SOAP: colors.primary, FREE_TEXT: colors.success, PROGRESS: colors.warning, HANDOVER: '#7C3AED',
}

function fmt(date: string) {
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('timeline')
  const [ddxLoading, setDdxLoading] = useState(false)
  const [ddxResults, setDdxResults] = useState<DdxResult[]>([])
  const [ddxSymptoms, setDdxSymptoms] = useState('')
  const [showDdxInput, setShowDdxInput] = useState(false)
  const qc = useQueryClient()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get(`/patients/${id}`)
      return (res.data.data ?? res.data) as Patient
    },
  })

  const { data: notes, isFetching: notesFetching } = useQuery({
    queryKey: ['notes', id],
    staleTime: 0,
    enabled: !!id,
    queryFn: async () => ((await api.get(`/notes?patientId=${id}`)).data.data ?? []) as ClinicalNote[],
  })

  const { data: tasks, isFetching: tasksFetching } = useQuery({
    queryKey: ['tasks', id],
    staleTime: 0,
    enabled: !!id,
    queryFn: async () => ((await api.get(`/tasks/patient/${id}`)).data.data ?? []) as Task[],
  })

  const { data: labs, isFetching: labsFetching } = useQuery({
    queryKey: ['labs', id],
    staleTime: 0,
    enabled: !!id,
    queryFn: async () => ((await api.get(`/labs/patient/${id}`)).data.data ?? []) as LabReport[],
  })

  const { data: meds, isFetching: medsFetching } = useQuery({
    queryKey: ['meds', id],
    staleTime: 0,
    enabled: activeTab === 'meds' && !!id,
    queryFn: async () => ((await api.get(`/medications/patient/${id}`)).data.data ?? []) as Medication[],
  })

  const { data: prescriptions, isFetching: rxFetching } = useQuery({
    queryKey: ['prescriptions', id],
    staleTime: 0,
    enabled: activeTab === 'rx' && !!id,
    queryFn: async () => ((await api.get(`/prescriptions/patient/${id}`)).data.data ?? []) as Prescription[],
  })

  const { data: recallRules } = useQuery({
    queryKey: ['recall', id],
    enabled: !!id,
    queryFn: async () => ((await api.get(`/recall/patient/${id}`)).data.data ?? []) as RecallRule[],
  })

  const timelineLoading = notesFetching || tasksFetching || labsFetching

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) =>
      api.patch(`/tasks/${taskId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
    onError: () => Alert.alert('Error', 'Failed to update task'),
  })

  async function runDdx() {
    if (!ddxSymptoms.trim()) return
    setDdxLoading(true)
    try {
      const res = await api.post('/ddx/generate', {
        patientId: id,
        symptoms: ddxSymptoms,
        contextNotes: notes.slice(0, 3).map((n) => n.content),
      })
      setDdxResults(res.data.differentials ?? [])
      setShowDdxInput(false)
    } catch {
      Alert.alert('Error', 'AI DDx failed. Please try again.')
    } finally {
      setDdxLoading(false)
    }
  }

  if (isLoading) {
    return <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} size="large" /></View>
  }
  if (!patient) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'notes', label: 'Notes' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'labs', label: 'Labs' },
    { key: 'meds', label: 'Meds' },
    { key: 'ddx', label: 'AI DDx' },
    { key: 'rx', label: 'Rx' },
  ]

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* ── Hero Header ── */}
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'<'}</Text>
          <Text style={styles.backLabel}>Patients</Text>
        </TouchableOpacity>

        <View style={styles.heroTitleRow}>
          <Text style={styles.heroMR}>MR# {patient.mrNumber}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[patient.status] ?? colors.gray400 }]}>
              <Text style={styles.statusBadgeText}>{patient.status}</Text>
            </View>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(app)/patients/edit?patientId=${id}`)}
              activeOpacity={0.8}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
        {patient.admissionDiagnosis ? (
          <Text style={styles.heroDx} numberOfLines={2}>{patient.admissionDiagnosis}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.handoverBtn}
          onPress={() => router.push(`/(app)/patients/handover?patientId=${id}`)}
          activeOpacity={0.8}
        >
          <Text style={styles.handoverBtnText}>⇄ Handover</Text>
        </TouchableOpacity>

        {/* Info pills */}
        <View style={styles.infoPills}>
          {[
            { label: 'Ward', value: patient.wardId ?? '—' },
            { label: 'Bed', value: patient.bedNumber ?? '—' },
            { label: 'Admitted', value: patient.admissionDate ? fmtDate(patient.admissionDate) : '—' },
          ].map(({ label, value }) => (
            <View key={label} style={styles.infoPill}>
              <Text style={styles.infoPillLabel}>{label}</Text>
              <Text style={styles.infoPillValue}>{value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Tab Bar ── */}
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

      {/* ── Tab Content ── */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>

        {/* TIMELINE */}
        {activeTab === 'timeline' && (
          <TimelineTab notes={notes ?? []} tasks={tasks ?? []} labs={labs ?? []} patientId={id!} loading={timelineLoading} recallRules={recallRules ?? []} />
        )}

        {/* NOTES */}
        {activeTab === 'notes' && (
          <NotesTab notes={notes ?? []} patientId={id!} loading={notesFetching} />
        )}

        {/* TASKS */}
        {activeTab === 'tasks' && (
          <TasksTab tasks={tasks ?? []} patientId={id!} loading={tasksFetching} onToggle={(taskId, status) => toggleTask.mutate({ taskId, status })} />
        )}

        {/* LABS */}
        {activeTab === 'labs' && (
          <LabsTab labs={labs ?? []} patientId={id!} loading={labsFetching} onRefresh={() => qc.invalidateQueries({ queryKey: ['labs', id] })} />
        )}

        {/* MEDS */}
        {activeTab === 'meds' && (
          <MedsTab meds={meds ?? []} patientId={id!} loading={medsFetching} />
        )}

        {/* AI DDx */}
        {activeTab === 'ddx' && (
          <DdxTab
            results={ddxResults}
            loading={ddxLoading}
            symptoms={ddxSymptoms}
            setSymptoms={setDdxSymptoms}
            showInput={showDdxInput}
            setShowInput={setShowDdxInput}
            onRun={runDdx}
          />
        )}

        {/* RX */}
        {activeTab === 'rx' && (
          <RxTab prescriptions={prescriptions ?? []} patientId={id!} loading={rxFetching} />
        )}

      </ScrollView>
    </View>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────────────────

function TimelineTab({ notes, tasks, labs, patientId, loading, recallRules }: { notes: ClinicalNote[]; tasks: Task[]; labs: LabReport[]; patientId: string; loading?: boolean; recallRules: RecallRule[] }) {
  type Event = { time: string; type: 'note' | 'task' | 'lab'; data: any }
  const events: Event[] = [
    ...notes.map((n) => ({ time: n.createdAt, type: 'note' as const, data: n })),
    ...tasks.map((t) => ({ time: t.createdAt ?? '', type: 'task' as const, data: t })),
    ...labs.map((l) => ({ time: l.reportedAt, type: 'lab' as const, data: l })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const activeRecall = recallRules.filter((r) => r.active)

  return (
    <View>
      <View style={tl.actions}>
        <ActionBtn label="+ Note" color={colors.primary} onPress={() => router.push(`/(app)/notes/new?patientId=${patientId}`)} />
        <ActionBtn label="+ Task" color={colors.success} onPress={() => router.push(`/(app)/tasks/new?patientId=${patientId}`)} />
      </View>

      {/* Recall section */}
      {activeRecall.length > 0 && (
        <View style={tl.recallSection}>
          <Text style={tl.recallHeader}>RECALL</Text>
          {activeRecall.map((rule) => (
            <View key={rule.id} style={tl.recallCard}>
              <View style={{ flex: 1 }}>
                <Text style={tl.recallDue}>Next recall due: {new Date(rule.nextDueAt).toLocaleDateString()}</Text>
                <Text style={tl.recallInterval}>Every {rule.intervalDays} days{rule.diagnosisNote ? ` · ${rule.diagnosisNote}` : ''}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={tl.recallBtn}
            onPress={() => router.push(`/(app)/patients/set-recall?patientId=${patientId}`)}
            activeOpacity={0.85}
          >
            <Text style={tl.recallBtnText}>+ Set Recall</Text>
          </TouchableOpacity>
        </View>
      )}
      {activeRecall.length === 0 && (
        <TouchableOpacity
          style={tl.recallBtnOutline}
          onPress={() => router.push(`/(app)/patients/set-recall?patientId=${patientId}`)}
          activeOpacity={0.85}
        >
          <Text style={tl.recallBtnOutlineText}>+ Set Recall Reminder</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.gray400, marginTop: spacing.md, fontSize: 13 }}>Loading timeline…</Text>
        </View>
      ) : events.length === 0 ? (
        <EmptyState icon="📋" text="No activity yet" />
      ) : (
        events.map((ev, i) => (
          <View key={i} style={tl.row}>
            <View style={tl.iconCol}>
              <Text style={tl.icon}>
                {ev.type === 'note' ? '📄' : ev.type === 'task' ? '✓' : '🧪'}
              </Text>
              {i < events.length - 1 && <View style={tl.line} />}
            </View>
            <View style={tl.card}>
              {ev.type === 'note' && <NoteTimelineCard note={ev.data} />}
              {ev.type === 'task' && <TaskTimelineCard task={ev.data} />}
              {ev.type === 'lab' && <LabTimelineCard lab={ev.data} />}
              <Text style={tl.time}>{fmt(ev.time)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  )
}

function NoteTimelineCard({ note }: { note: ClinicalNote }) {
  const color = NOTE_TYPE_COLOR[note.type] ?? colors.gray400
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <View style={[tl.typeBadge, { backgroundColor: color + '20' }]}>
          <Text style={[tl.typeBadgeText, { color }]}>{note.type.replace('_', ' ')}</Text>
        </View>
        {note.isDraft && <View style={tl.draftBadge}><Text style={tl.draftText}>DRAFT</Text></View>}
      </View>
      {note.type === 'SOAP' ? (
        <View>
          {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => {
            const val = (note.content as any)[k]
            if (!val) return null
            return <Text key={k} style={tl.noteText} numberOfLines={2}><Text style={{ fontWeight: '700' }}>{k.charAt(0).toUpperCase()}: </Text>{val}</Text>
          })}
        </View>
      ) : (
        <Text style={tl.noteText} numberOfLines={3}>{(note.content as any).text ?? ''}</Text>
      )}
    </View>
  )
}

function TaskTimelineCard({ task }: { task: Task }) {
  const color = PRIORITY_COLOR[task.priority] ?? colors.gray400
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={[tl.noteText, task.status === 'DONE' && { textDecorationLine: 'line-through', color: colors.gray400 }]} numberOfLines={2}>
        {task.title}
      </Text>
      <Text style={[tl.priorityText, { color }]}>{task.priority}</Text>
    </View>
  )
}

function LabTimelineCard({ lab }: { lab: LabReport }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={tl.noteText}>{lab.testName}</Text>
      <Text style={[tl.labValue, lab.isAbnormal && { color: lab.isCritical ? colors.danger : colors.warning }]}>
        {lab.value} {lab.unit}
      </Text>
    </View>
  )
}

const tl = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  iconCol: { width: 40, alignItems: 'center' },
  icon: { fontSize: 18, marginTop: 2 },
  line: { flex: 1, width: 1, backgroundColor: colors.gray200, marginTop: spacing.xs },
  card: {
    flex: 1, backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, marginLeft: spacing.sm, marginBottom: spacing.xs, ...shadow.sm,
  },
  typeBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  draftBadge: { backgroundColor: colors.warningLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  draftText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  noteText: { fontSize: 14, color: colors.gray700, lineHeight: 20 },
  time: { fontSize: 11, color: colors.gray400, marginTop: spacing.sm },
  priorityText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  labValue: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  recallSection: { backgroundColor: colors.primaryLight + '40', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg },
  recallHeader: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.8, marginBottom: spacing.sm },
  recallCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  recallDue: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  recallInterval: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  recallBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginTop: spacing.xs },
  recallBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  recallBtnOutline: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', marginBottom: spacing.lg },
  recallBtnOutlineText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
})

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ notes, patientId, loading }: { notes: ClinicalNote[]; patientId: string; loading?: boolean }) {
  return (
    <View>
      <TouchableOpacity style={nt.addBtn} onPress={() => router.push(`/(app)/notes/new?patientId=${patientId}`)} activeOpacity={0.85}>
        <Text style={nt.addBtnText}>+ New Note</Text>
      </TouchableOpacity>
      {loading ? <LoadingSpinner /> : notes.length === 0 ? <EmptyState icon="📝" text="No clinical notes yet" /> : notes.map((note) => (
        <View key={note.id} style={nt.card}>
          <View style={nt.header}>
            <View style={[nt.typeBadge, { backgroundColor: (NOTE_TYPE_COLOR[note.type] ?? colors.gray400) + '20' }]}>
              <Text style={[nt.typeText, { color: NOTE_TYPE_COLOR[note.type] ?? colors.gray400 }]}>{note.type.replace('_', ' ')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              {note.isDraft && <View style={nt.draft}><Text style={nt.draftText}>DRAFT</Text></View>}
              <Text style={nt.date}>{fmt(note.createdAt)}</Text>
            </View>
          </View>
          {note.type === 'SOAP' ? (
            <View style={{ gap: spacing.xs }}>
              {(['subjective', 'objective', 'assessment', 'plan'] as const).map((k) => {
                const val = (note.content as any)[k]
                if (!val) return null
                return (
                  <Text key={k} style={nt.soapLine} numberOfLines={3}>
                    <Text style={nt.soapKey}>{k.charAt(0).toUpperCase()}: </Text>{val}
                  </Text>
                )
              })}
            </View>
          ) : (
            <Text style={nt.body} numberOfLines={4}>{(note.content as any).text ?? ''}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

const nt = StyleSheet.create({
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg, ...shadow.sm },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  typeBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  draft: { backgroundColor: colors.warningLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  draftText: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  date: { fontSize: 12, color: colors.gray400 },
  body: { fontSize: 14, color: colors.gray700, lineHeight: 21 },
  soapLine: { fontSize: 14, color: colors.gray700, lineHeight: 20 },
  soapKey: { fontWeight: '700', color: colors.gray900 },
})

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ tasks, patientId, loading, onToggle }: { tasks: Task[]; patientId: string; loading?: boolean; onToggle: (id: string, status: string) => void }) {
  const pending = tasks.filter((t) => t.status !== 'DONE')
  const done = tasks.filter((t) => t.status === 'DONE')

  return (
    <View>
      <TouchableOpacity style={nt.addBtn} onPress={() => router.push(`/(app)/tasks/new?patientId=${patientId}`)} activeOpacity={0.85}>
        <Text style={nt.addBtnText}>+ Add Task</Text>
      </TouchableOpacity>
      {loading ? <LoadingSpinner /> : tasks.length === 0 ? <EmptyState icon="✅" text="No tasks for this patient" /> : null}
      {pending.length > 0 && (
        <>
          <Text style={tk.groupLabel}>PENDING ({pending.length})</Text>
          {pending.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
        </>
      )}
      {done.length > 0 && (
        <>
          <Text style={[tk.groupLabel, { marginTop: spacing.lg }]}>COMPLETED ({done.length})</Text>
          {done.map((t) => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
        </>
      )}
    </View>
  )
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string, status: string) => void }) {
  const color = PRIORITY_COLOR[task.priority] ?? colors.gray400
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
      <TouchableOpacity
        style={[tk.check, isDone && tk.checkDone]}
        onPress={() => onToggle(task.id, isDone ? 'PENDING' : 'DONE')}
        activeOpacity={0.75}
      >
        {isDone && <Text style={tk.checkMark}>✓</Text>}
      </TouchableOpacity>
    </View>
  )
}

const tk = StyleSheet.create({
  groupLabel: { ...typography.label, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, ...shadow.sm,
  },
  title: { fontSize: 15, fontWeight: '500', color: colors.gray900 },
  done: { textDecorationLine: 'line-through', color: colors.gray400 },
  pill: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  pillText: { fontSize: 11, fontWeight: '700' },
  due: { fontSize: 12, color: colors.gray400 },
  check: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: colors.gray300, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.lg },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 14, color: colors.white, fontWeight: '700' },
})

// ── Labs Tab ──────────────────────────────────────────────────────────────────

function LabsTab({ labs, patientId, loading, onRefresh }: { labs: LabReport[]; patientId: string; loading?: boolean; onRefresh: () => void }) {
  return (
    <View>
      <TouchableOpacity style={nt.addBtn} onPress={() => router.push(`/(app)/patients/add-lab?patientId=${patientId}`)} activeOpacity={0.85}>
        <Text style={nt.addBtnText}>+ Add Lab Result</Text>
      </TouchableOpacity>
      {loading ? <LoadingSpinner /> : labs.length === 0 ? <EmptyState icon="🧪" text="No lab reports yet" /> : null}
      {labs.map((lab) => {
        const abnormal = lab.isAbnormal
        const critical = lab.isCritical
        const valueColor = critical ? colors.danger : abnormal ? colors.warning : colors.gray900
        return (
          <View key={lab.id} style={[lb.card, critical && lb.criticalCard, abnormal && !critical && lb.abnormalCard]}>
            <View style={lb.row}>
              <View style={{ flex: 1 }}>
                <Text style={lb.testName}>{lab.testName}</Text>
                {lab.referenceRangeLow != null && lab.referenceRangeHigh != null ? (
                  <Text style={lb.refRange}>Ref: {lab.referenceRangeLow}–{lab.referenceRangeHigh} {lab.unit}</Text>
                ) : null}
                <Text style={lb.date}>{fmt(lab.reportedAt)}</Text>
              </View>
              <View style={lb.valueWrap}>
                <Text style={[lb.value, { color: valueColor }]}>{lab.value}</Text>
                <Text style={lb.unit}>{lab.unit}</Text>
                {critical && <Text style={lb.criticalTag}>CRITICAL</Text>}
                {abnormal && !critical && <Text style={lb.abnormalTag}>ABNORMAL</Text>}
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const lb = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.gray200, ...shadow.sm },
  criticalCard: { borderLeftColor: colors.danger },
  abnormalCard: { borderLeftColor: colors.warning },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  testName: { fontSize: 15, fontWeight: '600', color: colors.gray900, marginBottom: 2 },
  refRange: { fontSize: 12, color: colors.gray400 },
  date: { fontSize: 11, color: colors.gray400, marginTop: 4 },
  valueWrap: { alignItems: 'flex-end' },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  criticalTag: { fontSize: 10, fontWeight: '800', color: colors.danger, letterSpacing: 0.5, marginTop: 4 },
  abnormalTag: { fontSize: 10, fontWeight: '800', color: colors.warning, letterSpacing: 0.5, marginTop: 4 },
})

// ── Meds Tab ──────────────────────────────────────────────────────────────────

function MedsTab({ meds, patientId, loading }: { meds: Medication[]; patientId: string; loading?: boolean }) {
  const active = meds.filter((m) => !m.endDate || new Date(m.endDate) >= new Date())
  const stopped = meds.filter((m) => m.endDate && new Date(m.endDate) < new Date())

  return (
    <View>
      <TouchableOpacity style={nt.addBtn} onPress={() => router.push(`/(app)/patients/add-med?patientId=${patientId}`)} activeOpacity={0.85}>
        <Text style={nt.addBtnText}>+ Add Medication</Text>
      </TouchableOpacity>
      {loading ? <LoadingSpinner /> : meds.length === 0 ? <EmptyState icon="💊" text="No medications recorded" /> : null}
      {active.length > 0 && (
        <>
          <Text style={md.groupLabel}>ACTIVE ({active.length})</Text>
          {active.map((m) => <MedCard key={m.id} med={m} />)}
        </>
      )}
      {stopped.length > 0 && (
        <>
          <Text style={[md.groupLabel, { marginTop: spacing.lg }]}>STOPPED ({stopped.length})</Text>
          {stopped.map((m) => <MedCard key={m.id} med={m} stopped />)}
        </>
      )}
    </View>
  )
}


function MedCard({ med, stopped }: { med: Medication; stopped?: boolean }) {
  return (
    <View style={[md.card, stopped && md.stoppedCard]}>
      <View style={md.row}>
        <View style={{ flex: 1 }}>
          <Text style={[md.drugName, stopped && md.stoppedText]}>{med.drugName}</Text>
          <Text style={md.details}>{med.dose} · {med.route} · {med.frequency}</Text>
          <Text style={md.date}>
            Started {fmtDate(med.startDate)}{med.endDate ? ` → ${fmtDate(med.endDate)}` : ''}
          </Text>
        </View>
        {med.isPrn && (
          <View style={md.prnBadge}><Text style={md.prnText}>PRN</Text></View>
        )}
      </View>
    </View>
  )
}

const md = StyleSheet.create({
  groupLabel: { ...typography.label, marginBottom: spacing.sm },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.success, ...shadow.sm },
  stoppedCard: { borderLeftColor: colors.gray300, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  drugName: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 3 },
  stoppedText: { textDecorationLine: 'line-through', color: colors.gray400 },
  details: { fontSize: 14, color: colors.gray600 ?? colors.gray500, marginBottom: 2 },
  date: { fontSize: 12, color: colors.gray400 },
  prnBadge: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  prnText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
})

// ── AI DDx Tab ────────────────────────────────────────────────────────────────

function DdxTab({ results, loading, symptoms, setSymptoms, showInput, setShowInput, onRun }: {
  results: DdxResult[]; loading: boolean; symptoms: string
  setSymptoms: (s: string) => void; showInput: boolean
  setShowInput: (v: boolean) => void; onRun: () => void
}) {
  return (
    <View>
      <View style={dx.intro}>
        <Text style={dx.introTitle}>AI Differential Diagnosis</Text>
        <Text style={dx.introSub}>Enter presenting symptoms and let Claude generate a prioritised DDx with reasoning.</Text>
      </View>

      {!showInput && (
        <TouchableOpacity style={dx.runBtn} onPress={() => setShowInput(true)} activeOpacity={0.85}>
          <Text style={dx.runBtnText}>Generate DDx</Text>
        </TouchableOpacity>
      )}

      {showInput && (
        <View style={dx.inputCard}>
          <Text style={dx.inputLabel}>Presenting Symptoms & History</Text>
          <TextInput
            style={dx.input}
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g. 65yo male, 3-day fever, productive cough, RLL dullness on percussion…"
            placeholderTextColor={colors.gray300}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[dx.runBtn, { marginTop: spacing.md }]}
            onPress={onRun}
            disabled={loading || !symptoms.trim()}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={dx.runBtnText}>Run AI DDx</Text>}
          </TouchableOpacity>
        </View>
      )}

      {results.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={dx.resultsLabel}>DIFFERENTIAL DIAGNOSES</Text>
          {results.map((r, i) => (
            <View key={i} style={dx.resultCard}>
              <View style={dx.resultHeader}>
                <View style={dx.rankCircle}>
                  <Text style={dx.rankText}>{i + 1}</Text>
                </View>
                <Text style={dx.diagnosisText}>{r.diagnosis}</Text>
                <View style={[dx.probBadge, { backgroundColor: r.probability > 0.6 ? colors.dangerLight : r.probability > 0.3 ? colors.warningLight : colors.gray100 }]}>
                  <Text style={[dx.probText, { color: r.probability > 0.6 ? colors.danger : r.probability > 0.3 ? colors.warning : colors.gray500 }]}>
                    {Math.round(r.probability * 100)}%
                  </Text>
                </View>
              </View>
              <Text style={dx.reasoning}>{r.reasoning}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const dx = StyleSheet.create({
  intro: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  introTitle: { fontSize: 16, fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.xs },
  introSub: { fontSize: 13, color: colors.primaryDark, lineHeight: 19, opacity: 0.8 },
  runBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', ...shadow.sm },
  runBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  inputCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm, marginBottom: spacing.md },
  inputLabel: { ...typography.label, marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md, padding: spacing.md, fontSize: 14, color: colors.gray900, minHeight: 100, lineHeight: 21 },
  resultsLabel: { ...typography.label, marginBottom: spacing.md },
  resultCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  rankCircle: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  rankText: { fontSize: 13, fontWeight: '800', color: colors.white },
  diagnosisText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.gray900 },
  probBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  probText: { fontSize: 12, fontWeight: '800' },
  reasoning: { fontSize: 13, color: colors.gray500, lineHeight: 19 },
})

// ── Rx Tab ────────────────────────────────────────────────────────────────────

function RxTab({ prescriptions, patientId, loading }: { prescriptions: Prescription[]; patientId: string; loading?: boolean }) {
  function rxStatus(rx: Prescription): 'Active' | 'Dispensed' | 'Revoked' {
    if (rx.revokedAt) return 'Revoked'
    if (rx.verifiedAt) return 'Dispensed'
    return 'Active'
  }

  const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
    Active: { bg: colors.successLight, color: colors.success },
    Dispensed: { bg: '#DBEAFE', color: '#1D4ED8' },
    Revoked: { bg: colors.dangerLight, color: colors.danger },
  }

  return (
    <View>
      <TouchableOpacity
        style={rx.addBtn}
        onPress={() => router.push(`/(app)/patients/new-rx?patientId=${patientId}`)}
        activeOpacity={0.85}
      >
        <Text style={rx.addBtnText}>+ New Prescription</Text>
      </TouchableOpacity>

      {loading ? (
        <LoadingSpinner />
      ) : prescriptions.length === 0 ? (
        <EmptyState icon="💊" text="No prescriptions yet" />
      ) : (
        prescriptions.map((p) => {
          const status = rxStatus(p)
          const badge = STATUS_BADGE[status]
          const parsedDrugs: Prescription['drugs'] =
            typeof p.drugs === 'string' ? JSON.parse(p.drugs) : p.drugs ?? []
          const drugNames = parsedDrugs.map((d) => d.name).join(', ')
          return (
            <View key={p.id} style={rx.card}>
              <View style={rx.cardHeader}>
                <Text style={rx.drugNames} numberOfLines={1}>{drugNames || '—'}</Text>
                <View style={[rx.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[rx.badgeText, { color: badge.color }]}>{status}</Text>
                </View>
              </View>
              <Text style={rx.date}>{fmtDate(p.createdAt)}</Text>
              <Text style={rx.hash}>#{p.hash.slice(0, 8)}</Text>
            </View>
          )
        })
      )}
    </View>
  )
}

const rx = StyleSheet.create({
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.lg, ...shadow.sm },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  drugNames: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.gray900, marginRight: spacing.sm },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  date: { fontSize: 12, color: colors.gray400, marginBottom: 2 },
  hash: { fontSize: 11, color: colors.gray300, fontFamily: 'monospace' },
})

// ── Shared ────────────────────────────────────────────────────────────────────

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[ab.btn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.85}>
      <Text style={ab.text}>{label}</Text>
    </TouchableOpacity>
  )
}
const ab = StyleSheet.create({
  btn: { flex: 1, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', ...shadow.sm },
  text: { color: colors.white, fontWeight: '700', fontSize: 14 },
})

function LoadingSpinner() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  )
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={em.wrap}>
      <Text style={em.icon}>{icon}</Text>
      <Text style={em.text}>{text}</Text>
    </View>
  )
}
const em = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48 },
  icon: { fontSize: 36, marginBottom: spacing.md, opacity: 0.35 },
  text: { ...typography.bodySmall, textAlign: 'center' },
})

// ── Styles ────────────────────────────────────────────────────────────────────

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
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  heroMR: { fontSize: 22, fontWeight: '800', color: colors.white, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 4 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  heroDx: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 20, marginBottom: spacing.md },
  handoverBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  handoverBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  infoPills: { flexDirection: 'row', gap: spacing.sm },
  infoPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.sm },
  infoPillLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  infoPillValue: { fontSize: 13, fontWeight: '700', color: colors.white },

  tabBarWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  tabBar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  tab: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },

  content: { flex: 1 },
  contentInner: { padding: spacing.xxl, paddingBottom: 48 },
})
