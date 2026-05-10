import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import type { Task } from '../../../src/types'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

type FilterTab = 'ALL' | 'PENDING' | 'DONE'

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

const PRIORITY_CONFIG: Record<string, { stripe: string; label: string }> = {
  HIGH: { stripe: colors.danger, label: 'High' },
  MEDIUM: { stripe: colors.warning, label: 'Medium' },
  LOW: { stripe: colors.gray300, label: 'Low' },
}

const FILTERS: FilterTab[] = ['ALL', 'PENDING', 'DONE']
const FILTER_LABELS: Record<FilterTab, string> = {
  ALL: 'All',
  PENDING: 'Pending',
  DONE: 'Completed',
}

export default function TasksScreen() {
  const [filter, setFilter] = useState<FilterTab>('ALL')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    staleTime: 0,
    queryFn: async () => {
      const res = await api.get('/tasks')
      return ((res.data.data ?? []) as (Task & { patient?: { id: string; mrNumber: string } })[])
    },
  })

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      await api.patch(`/tasks/${taskId}/status`, { status })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] }),
    onError: () => Alert.alert('Error', 'Failed to update task'),
  })

  const filtered = (data ?? [])
    .filter((t) => {
      if (filter === 'ALL') return true
      return t.status === filter
    })
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))

  const pendingCount = (data ?? []).filter((t) => t.status === 'PENDING').length

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={styles.headerTitle}>My Tasks</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(app)/tasks/new')}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Segmented filter */}
        <View style={styles.segmented}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.segment, filter === f && styles.segmentActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, filter === f && styles.segmentTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const priorityCfg = PRIORITY_CONFIG[item.priority] ?? { stripe: colors.gray300, label: item.priority }
            const isDone = item.status === 'DONE'
            return (
              <View style={styles.card}>
                {/* Priority stripe */}
                <View style={[styles.priorityStripe, { backgroundColor: priorityCfg.stripe }]} />

                <View style={styles.cardBody}>
                  <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
                        {item.title}
                      </Text>

                      <View style={styles.metaRow}>
                        {/* Priority label */}
                        <View style={[styles.priorityPill, { borderColor: priorityCfg.stripe }]}>
                          <Text style={[styles.priorityPillText, { color: priorityCfg.stripe }]}>
                            {priorityCfg.label}
                          </Text>
                        </View>

                        {/* Patient MR chip */}
                        {(item as any).patient?.mrNumber ? (
                          <View style={styles.mrChip}>
                            <Text style={styles.mrChipText}>MR# {(item as any).patient.mrNumber}</Text>
                          </View>
                        ) : null}

                        {/* Due date */}
                        {item.dueAt ? (
                          <Text style={styles.dueText}>
                            Due {new Date(item.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Check circle */}
                    <TouchableOpacity
                      style={[styles.checkCircle, isDone && styles.checkCircleDone]}
                      onPress={() =>
                        toggleTask.mutate({ taskId: item.id, status: isDone ? 'PENDING' : 'DONE' })
                      }
                      activeOpacity={0.75}
                    >
                      {isDone && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>
                {filter === 'DONE' ? '🎉' : '✓'}
              </Text>
              <Text style={styles.emptyTitle}>
                {filter === 'DONE' ? 'No completed tasks' : 'No tasks here'}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'PENDING'
                  ? 'You are all caught up!'
                  : 'Tasks assigned to you will appear here'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    backgroundColor: colors.screenBg,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
  },
  pendingBadge: {
    backgroundColor: colors.warning,
    borderRadius: radius.full,
    minWidth: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: 2,
  },
  pendingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray500,
  },
  segmentTextActive: {
    color: colors.gray900,
    fontWeight: '700',
  },

  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: 32,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.sm,
  },
  priorityStripe: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: spacing.lg,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  taskTitleDone: {
    color: colors.gray400,
    textDecorationLine: 'line-through',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  priorityPill: {
    borderWidth: 1.5,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  mrChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mrChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    fontVariant: ['tabular-nums'],
  },
  dueText: {
    fontSize: 12,
    color: colors.gray400,
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.gray300,
    marginLeft: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkCircleDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkMark: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '800',
  },

  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.lg,
    opacity: 0.4,
  },
  emptyTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    ...typography.bodySmall,
    textAlign: 'center',
  },
})
