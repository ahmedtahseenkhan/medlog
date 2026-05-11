import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Task } from '../../../src/db/models/Task'
import type { Patient } from '../../../src/db/models/Patient'
import { Q } from '@nozbe/watermelondb'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

type FilterTab = 'ALL' | 'PENDING' | 'DONE'

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const PRIORITY_CONFIG: Record<string, { stripe: string; label: string }> = {
  URGENT: { stripe: '#7C3AED', label: 'Urgent' },
  HIGH: { stripe: colors.danger, label: 'High' },
  MEDIUM: { stripe: colors.warning, label: 'Medium' },
  LOW: { stripe: colors.gray300, label: 'Low' },
}
const FILTERS: FilterTab[] = ['ALL', 'PENDING', 'DONE']
const FILTER_LABELS: Record<FilterTab, string> = { ALL: 'All', PENDING: 'Pending', DONE: 'Completed' }

interface TaskWithPatient {
  task: Task
  patient: Patient | null
}

export default function TasksScreen() {
  const [filter, setFilter] = useState<FilterTab>('PENDING')
  const [items, setItems] = useState<TaskWithPatient[]>([])

  useEffect(() => {
    const sub = database.get<Task>('tasks')
      .query()
      .observe()
      .subscribe(async (tasks) => {
        const withPatients = await Promise.all(
          tasks.map(async (t) => {
            const patient = await database.get<Patient>('patients').find(t.patientId).catch(() => null)
            return { task: t, patient }
          })
        )
        setItems(withPatients)
      })
    return () => sub.unsubscribe()
  }, [])

  async function toggleTask(taskId: string, currentStatus: string) {
    const task = await database.get<Task>('tasks').find(taskId)
    await database.write(async () => {
      await task.update((t) => {
        t.status = currentStatus === 'DONE' ? 'PENDING' : 'DONE'
      })
    })
  }

  const filtered = items
    .filter(({ task }) => filter === 'ALL' || task.status === filter)
    .sort((a, b) => (PRIORITY_ORDER[a.task.priority] ?? 4) - (PRIORITY_ORDER[b.task.priority] ?? 4))

  const pendingCount = items.filter(({ task }) => task.status !== 'DONE').length

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={styles.headerTitle}>Tasks</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(app)/tasks/new')} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segmented}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[styles.segment, filter === f && styles.segmentActive]} onPress={() => setFilter(f)} activeOpacity={0.75}>
              <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>{FILTER_LABELS[f]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={({ task }) => task.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: { task, patient } }) => {
          const cfg = PRIORITY_CONFIG[task.priority] ?? { stripe: colors.gray300, label: task.priority }
          const isDone = task.status === 'DONE'
          const isOverdue = task.dueAt && task.dueAt < Date.now() && !isDone
          return (
            <View style={styles.card}>
              <View style={[styles.priorityStripe, { backgroundColor: cfg.stripe }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>{task.title}</Text>
                    <View style={styles.metaRow}>
                      <View style={[styles.priorityPill, { borderColor: cfg.stripe }]}>
                        <Text style={[styles.priorityPillText, { color: cfg.stripe }]}>{cfg.label}</Text>
                      </View>
                      {patient && (
                        <TouchableOpacity style={styles.mrChip} onPress={() => router.push(`/(app)/patients/${patient.id}` as any)} activeOpacity={0.75}>
                          <Text style={styles.mrChipText}>{patient.name ?? `MR# ${patient.mrNumber}`}</Text>
                        </TouchableOpacity>
                      )}
                      {task.dueAt ? (
                        <Text style={[styles.dueText, isOverdue ? { color: colors.danger, fontWeight: '700' } : {}]}>
                          {isOverdue ? 'Overdue · ' : 'Due '}
                          {new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity style={[styles.checkCircle, isDone && styles.checkCircleDone]} onPress={() => toggleTask(task.id, task.status)} activeOpacity={0.75}>
                    {isDone && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{filter === 'DONE' ? '🎉' : '✓'}</Text>
            <Text style={styles.emptyTitle}>{filter === 'DONE' ? 'No completed tasks' : filter === 'PENDING' ? 'All clear!' : 'No tasks yet'}</Text>
            <Text style={styles.emptySubtext}>{filter === 'PENDING' ? 'No pending tasks right now' : 'Tap + New to add a task for a patient'}</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: { backgroundColor: colors.screenBg, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  headerTitle: { ...typography.h1 },
  pendingBadge: { backgroundColor: colors.warning, borderRadius: radius.full, minWidth: 26, height: 26, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, marginTop: 2 },
  pendingBadgeText: { fontSize: 13, fontWeight: '800', color: colors.white },
  addBtn: { marginLeft: 'auto', backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  segmented: { flexDirection: 'row', backgroundColor: colors.gray100, borderRadius: radius.full, padding: 3 },
  segment: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.white, ...shadow.sm },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  segmentTextActive: { color: colors.gray900, fontWeight: '700' },
  listContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: 32 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.md, flexDirection: 'row', overflow: 'hidden', ...shadow.sm },
  priorityStripe: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  taskTitle: { fontSize: 15, fontWeight: '600', color: colors.gray900, lineHeight: 21, marginBottom: spacing.sm },
  taskTitleDone: { color: colors.gray400, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priorityPill: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  priorityPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  mrChip: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  mrChipText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  dueText: { fontSize: 12, color: colors.gray400 },
  checkCircle: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: colors.gray300, marginLeft: spacing.lg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 14, color: colors.white, fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.lg, opacity: 0.4 },
  emptyTitle: { ...typography.h4, marginBottom: spacing.sm },
  emptySubtext: { ...typography.bodySmall, textAlign: 'center' },
})
