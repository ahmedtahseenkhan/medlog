import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id: string
  title: string
  priority: string
  dueAt?: string | null
}

interface LabResult {
  testName: string
  value: string
  unit: string
  reportedAt: string
}

interface RecentNote {
  type: string
  author: string
  role: string
  date: string
  summary: string
}

interface HandoverSummary {
  patient: {
    mrNumber: string
    ward: string
    bed: string
    admissionDiagnosis?: string | null
    admissionDate?: string | null
  }
  currentPlan: string
  recentNotes: RecentNote[]
  pendingTasks: { urgent: Task[]; routine: Task[] }
  abnormalLabs: { critical: LabResult[]; abnormal: LabResult[] }
  generatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={sectionStyles.header}>{title}</Text>
}

const sectionStyles = StyleSheet.create({
  header: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HandoverScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const [summary, setSummary] = useState<HandoverSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [committing, setCommitting] = useState(false)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/handover/patient/${patientId}`)
      setSummary(data.data)
    } catch {
      Alert.alert('Error', 'Could not load handover summary.')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleCommit = async () => {
    Alert.alert(
      'Commit Handover',
      'This will create a handover note and reassign pending tasks. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Commit',
          style: 'default',
          onPress: async () => {
            setCommitting(true)
            try {
              await api.post(`/handover/patient/${patientId}/commit`, {
                additionalNotes: additionalNotes.trim() || undefined,
              })
              Alert.alert('Handover Committed', 'The handover note has been saved successfully.', [
                { text: 'OK', onPress: () => router.back() },
              ])
            } catch {
              Alert.alert('Error', 'Failed to commit handover. Please try again.')
            } finally {
              setCommitting(false)
            }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Handover</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Building handover summary…</Text>
        </View>
      ) : summary ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Patient Info Card */}
            <View style={styles.card}>
              <Text style={styles.mrNumber}>MR# {summary.patient.mrNumber}</Text>
              <View style={styles.infoRow}>
                <InfoPill label="Ward" value={summary.patient.ward} />
                <InfoPill label="Bed" value={summary.patient.bed} />
              </View>
              {summary.patient.admissionDiagnosis && (
                <Text style={styles.diagnosisText}>
                  Dx: {summary.patient.admissionDiagnosis}
                </Text>
              )}
              {summary.patient.admissionDate && (
                <Text style={styles.metaText}>Admitted: {formatDate(summary.patient.admissionDate)}</Text>
              )}
            </View>

            {/* Current Plan */}
            <SectionHeader title="Current Plan" />
            <View style={[styles.card, styles.planCard]}>
              <Text style={styles.planText}>{summary.currentPlan}</Text>
            </View>

            {/* Pending Tasks */}
            {(summary.pendingTasks.urgent.length > 0 || summary.pendingTasks.routine.length > 0) && (
              <>
                <SectionHeader title="Pending Tasks" />
                {summary.pendingTasks.urgent.map((task) => (
                  <TaskRow key={task.id} task={task} urgent />
                ))}
                {summary.pendingTasks.routine.map((task) => (
                  <TaskRow key={task.id} task={task} urgent={false} />
                ))}
              </>
            )}

            {/* Abnormal Labs */}
            {(summary.abnormalLabs.critical.length > 0 || summary.abnormalLabs.abnormal.length > 0) && (
              <>
                <SectionHeader title="Abnormal Labs" />
                {summary.abnormalLabs.critical.map((lab, i) => (
                  <LabRow key={`crit-${i}`} lab={lab} critical />
                ))}
                {summary.abnormalLabs.abnormal.map((lab, i) => (
                  <LabRow key={`abn-${i}`} lab={lab} critical={false} />
                ))}
              </>
            )}

            {/* Recent Notes */}
            {summary.recentNotes.length > 0 && (
              <>
                <SectionHeader title="Recent Notes" />
                {summary.recentNotes.map((note, i) => (
                  <NoteRow key={i} note={note} />
                ))}
              </>
            )}

            {/* Additional Notes Input */}
            <SectionHeader title="Additional Notes" />
            <TextInput
              style={styles.notesInput}
              placeholder="Any additional handover information…"
              placeholderTextColor={colors.gray400}
              multiline
              numberOfLines={4}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              textAlignVertical="top"
            />

            <View style={{ height: spacing.xxxl }} />
          </ScrollView>

          {/* Bottom action bar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.commitBtn, committing && styles.commitBtnDisabled]}
              onPress={handleCommit}
              disabled={committing}
              activeOpacity={0.85}
            >
              {committing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.commitBtnText}>Commit Handover</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load handover summary.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSummary}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.label}>{label}</Text>
      <Text style={pillStyles.value}>{value}</Text>
    </View>
  )
}

function TaskRow({ task, urgent }: { task: Task; urgent: boolean }) {
  return (
    <View style={[taskStyles.row, urgent ? taskStyles.urgent : taskStyles.routine]}>
      <View style={[taskStyles.dot, { backgroundColor: urgent ? '#EF4444' : colors.gray400 }]} />
      <View style={{ flex: 1 }}>
        <Text style={taskStyles.title}>{task.title}</Text>
        {task.dueAt && <Text style={taskStyles.due}>Due: {formatDate(task.dueAt)}</Text>}
      </View>
      <View style={[taskStyles.badge, { backgroundColor: urgent ? '#FEE2E2' : colors.gray100 }]}>
        <Text style={[taskStyles.badgeText, { color: urgent ? '#EF4444' : colors.gray500 }]}>
          {task.priority}
        </Text>
      </View>
    </View>
  )
}

function LabRow({ lab, critical }: { lab: LabResult; critical: boolean }) {
  return (
    <View style={[labStyles.row, critical ? labStyles.critical : labStyles.abnormal]}>
      <View style={{ flex: 1 }}>
        <Text style={labStyles.name}>{lab.testName}</Text>
        <Text style={labStyles.value}>
          {lab.value} {lab.unit}
        </Text>
      </View>
      <View style={[labStyles.badge, { backgroundColor: critical ? '#FEE2E2' : '#FFFBEB' }]}>
        <Text style={[labStyles.badgeText, { color: critical ? '#EF4444' : '#D97706' }]}>
          {critical ? 'CRITICAL' : 'ABNORMAL'}
        </Text>
      </View>
    </View>
  )
}

function NoteRow({ note }: { note: RecentNote }) {
  return (
    <View style={noteStyles.row}>
      <View style={noteStyles.header}>
        <Text style={noteStyles.type}>{note.type}</Text>
        <Text style={noteStyles.meta}>{note.author} · {formatDate(note.date)}</Text>
      </View>
      <Text style={noteStyles.summary} numberOfLines={3}>{note.summary}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  backText: { fontSize: 28, color: colors.white, lineHeight: 32 },
  headerTitle: { ...typography.h3, color: colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loadingText: { ...typography.bodySmall, color: colors.gray500, marginTop: spacing.md },
  errorText: { ...typography.body, color: colors.gray700, marginBottom: spacing.lg },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  retryText: { color: colors.white, fontWeight: '700' },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  planCard: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  mrNumber: { ...typography.h2, color: colors.gray900, marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  diagnosisText: { ...typography.body, color: colors.gray700, marginBottom: spacing.xs },
  metaText: { ...typography.bodySmall, color: colors.gray500 },
  planText: { ...typography.body, color: colors.gray700, lineHeight: 22 },

  notesInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.gray900,
    minHeight: 100,
    ...shadow.sm,
  },

  bottomBar: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    ...shadow.md,
  },
  commitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.md,
  },
  commitBtnDisabled: { opacity: 0.65 },
  commitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
})

const pillStyles = StyleSheet.create({
  pill: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    minWidth: 72,
  },
  label: { fontSize: 10, fontWeight: '600', color: colors.primary, letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { fontSize: 14, fontWeight: '700', color: colors.gray900, marginTop: 1 },
})

const taskStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.sm,
  },
  urgent: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  routine: { borderLeftWidth: 3, borderLeftColor: colors.gray300 },
  dot: { width: 8, height: 8, borderRadius: radius.full, flexShrink: 0 },
  title: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  due: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
})

const labStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow.sm,
  },
  critical: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  abnormal: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  name: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  value: { fontSize: 13, color: colors.gray700, marginTop: 2 },
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
})

const noteStyles = StyleSheet.create({
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  type: { fontSize: 12, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },
  meta: { fontSize: 11, color: colors.gray400 },
  summary: { fontSize: 13, color: colors.gray700, lineHeight: 18 },
})
