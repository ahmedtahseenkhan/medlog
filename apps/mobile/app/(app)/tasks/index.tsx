import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, StatusBar, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Task } from '../../../src/db/models/Task'
import type { Patient } from '../../../src/db/models/Patient'
import { colors, spacing, radius, shadow } from '../../../src/theme'

type FilterTab = 'ALL' | 'PENDING' | 'DONE'

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const PRIORITY_CONFIG: Record<string, { stripe: string; label: string }> = {
  URGENT: { stripe: '#7C3AED', label: 'Urgent' },
  HIGH:   { stripe: colors.critical, label: 'High' },
  MEDIUM: { stripe: colors.warning,  label: 'Medium' },
  LOW:    { stripe: colors.textSoft, label: 'Low' },
}
const FILTERS: FilterTab[] = ['ALL', 'PENDING', 'DONE']
const FILTER_LABELS: Record<FilterTab, string> = { ALL: 'All', PENDING: 'Pending', DONE: 'Completed' }

interface TaskWithPatient { task: Task; patient: Patient | null }

export default function TasksScreen() {
  const [filter, setFilter] = useState<FilterTab>('PENDING')
  const [items, setItems] = useState<TaskWithPatient[]>([])

  useEffect(() => {
    const sub = database.get<Task>('tasks').query().observe().subscribe(async (tasks) => {
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
  const overdueCount = items.filter(({ task }) => task.dueAt && task.dueAt < Date.now() && task.status !== 'DONE').length

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Teal header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.title}>Tasks</Text>
            <Text style={s.subtitle}>
              {pendingCount} pending
              {overdueCount > 0 ? <Text style={s.overdueNote}>  ·  {overdueCount} overdue</Text> : null}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push('/(app)/tasks/new')} activeOpacity={0.8}>
            <Text style={s.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{items.length}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={[s.statCard, pendingCount > 0 && { borderColor: colors.warning + '50' }]}>
            <Text style={[s.statValue, pendingCount > 0 && { color: colors.warning }]}>{pendingCount}</Text>
            <Text style={s.statLabel}>Pending</Text>
          </View>
          <View style={[s.statCard, overdueCount > 0 && { borderColor: colors.critical + '50' }]}>
            <Text style={[s.statValue, overdueCount > 0 && { color: colors.critical }]}>{overdueCount}</Text>
            <Text style={s.statLabel}>Overdue</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: colors.success }]}>{items.filter(({ task }) => task.status === 'DONE').length}</Text>
            <Text style={s.statLabel}>Done</Text>
          </View>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[s.pill, filter === f && s.pillActive]} onPress={() => setFilter(f)} activeOpacity={0.75}>
              <Text style={[s.pillText, filter === f && s.pillTextActive]}>{FILTER_LABELS[f]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={({ task }) => task.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item: { task, patient } }) => {
          const cfg = PRIORITY_CONFIG[task.priority] ?? { stripe: colors.textSoft, label: task.priority }
          const isDone = task.status === 'DONE'
          const isOverdue = task.dueAt && task.dueAt < Date.now() && !isDone
          return (
            <View style={[s.card, isOverdue && s.cardOverdue]}>
              <View style={[s.priorityStripe, { backgroundColor: cfg.stripe }]} />
              <View style={s.cardBody}>
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.taskTitle, isDone && s.taskTitleDone]} numberOfLines={2}>{task.title}</Text>
                    <View style={s.metaRow}>
                      <View style={[s.priorityPill, { borderColor: cfg.stripe }]}>
                        <Text style={[s.priorityPillText, { color: cfg.stripe }]}>{cfg.label}</Text>
                      </View>
                      {patient && (
                        <TouchableOpacity style={s.mrChip} onPress={() => router.push(`/(app)/patients/${patient.id}` as any)} activeOpacity={0.75}>
                          <Text style={s.mrChipText}>{patient.name ?? `MR# ${patient.mrNumber}`}</Text>
                        </TouchableOpacity>
                      )}
                      {task.dueAt ? (
                        <Text style={[s.dueText, isOverdue ? s.dueOverdue : {}]}>
                          {isOverdue ? '⚠ Overdue' : 'Due '}
                          {!isOverdue && new Date(task.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity style={[s.checkCircle, isDone && s.checkCircleDone]} onPress={() => toggleTask(task.id, task.status)} activeOpacity={0.75}>
                    {isDone && <Text style={s.checkMark}>✓</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Text style={{ fontSize: 28 }}>{filter === 'DONE' ? '🎉' : '✓'}</Text>
            </View>
            <Text style={s.emptyTitle}>{filter === 'DONE' ? 'No completed tasks' : filter === 'PENDING' ? 'All clear!' : 'No tasks yet'}</Text>
            <Text style={s.emptySubtext}>{filter === 'PENDING' ? 'No pending tasks right now' : 'Tap + New to add a task for a patient'}</Text>
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  overdueNote: { color: '#FCA5A5', fontWeight: '700' },

  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xxl,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 1 },

  filterRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillActive: { backgroundColor: colors.white, borderColor: colors.white },
  pillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  pillTextActive: { color: colors.primary, fontWeight: '700' },

  listContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: 32 },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.md,
  },
  cardOverdue: { borderWidth: 1.5, borderColor: colors.criticalBorder },
  priorityStripe: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardRow: { flexDirection: 'row', alignItems: 'center' },

  taskTitle: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 21, marginBottom: spacing.sm },
  taskTitleDone: { color: colors.textSoft, textDecorationLine: 'line-through' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  priorityPill: { borderWidth: 1.5, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  priorityPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  mrChip: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  mrChipText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  dueText: { fontSize: 12, color: colors.textSoft },
  dueOverdue: { color: colors.critical, fontWeight: '700' },

  checkCircle: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2, borderColor: colors.line, marginLeft: spacing.lg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkCircleDone: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { fontSize: 14, color: colors.white, fontWeight: '800' },

  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptySubtext: { fontSize: 14, color: colors.textSoft, textAlign: 'center' },
})
