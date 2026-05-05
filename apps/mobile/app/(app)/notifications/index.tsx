import { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, SectionList,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import type { LabReport } from '../../../src/db/models/LabReport'
import type { Task } from '../../../src/db/models/Task'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'
import { Q } from '@nozbe/watermelondb'

interface AlertItem {
  id: string
  type: 'FOLLOW_UP_OVERDUE' | 'FOLLOW_UP_TODAY' | 'FOLLOW_UP_SOON' | 'CRITICAL_LAB' | 'ABNORMAL_LAB' | 'TASK_OVERDUE'
  title: string
  body: string
  patientId?: string
  urgency: 'critical' | 'warning' | 'info'
  createdAt: number
}

const URGENCY_CONFIG = {
  critical: { bg: colors.dangerLight, border: colors.danger, icon: '🚨', text: '#991B1B' },
  warning: { bg: colors.warningLight, border: colors.warning, icon: '⚠️', text: '#92400E' },
  info: { bg: colors.primaryLight, border: colors.primary, icon: '🔔', text: colors.primaryDark },
}

function fmt(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysFromNow(ts: number): number {
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24))
}

function useAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])

  useEffect(() => {
    async function buildAlerts() {
      const now = Date.now()
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
      const threeDaysFromNow = now + 3 * 24 * 60 * 60 * 1000
      const items: AlertItem[] = []

      // Follow-up alerts — patients with follow_up_date set
      const patientsWithFollowUp = await database
        .get<Patient>('patients')
        .query(Q.where('follow_up_date', Q.notEq(null)))
        .fetch()

      for (const p of patientsWithFollowUp) {
        if (!p.followUpDate) continue
        const daysLeft = daysFromNow(p.followUpDate)
        const label = p.name ? `${p.name} (MR# ${p.mrNumber})` : `MR# ${p.mrNumber}`

        if (daysLeft < 0) {
          items.push({
            id: `fu-overdue-${p.id}`,
            type: 'FOLLOW_UP_OVERDUE',
            title: `Follow-up Overdue — ${label}`,
            body: `Follow-up was due ${Math.abs(daysLeft)} day(s) ago (${fmt(p.followUpDate)}).${p.followUpNotes ? ` Notes: ${p.followUpNotes}` : ''} Contact patient or reschedule.`,
            patientId: p.id,
            urgency: 'warning',
            createdAt: p.followUpDate,
          })
        } else if (daysLeft === 0) {
          items.push({
            id: `fu-today-${p.id}`,
            type: 'FOLLOW_UP_TODAY',
            title: `Follow-up Today — ${label}`,
            body: `Check if patient has arrived for their follow-up.${p.followUpNotes ? ` Notes: ${p.followUpNotes}` : ''}`,
            patientId: p.id,
            urgency: 'warning',
            createdAt: p.followUpDate,
          })
        } else if (daysLeft <= 3) {
          items.push({
            id: `fu-soon-${p.id}`,
            type: 'FOLLOW_UP_SOON',
            title: `Follow-up in ${daysLeft}d — ${label}`,
            body: `Follow-up on ${fmt(p.followUpDate)}.${p.followUpNotes ? ` Notes: ${p.followUpNotes}` : ''}`,
            patientId: p.id,
            urgency: 'info',
            createdAt: p.followUpDate,
          })
        }
      }

      // Abnormal lab alerts — labs from last 7 days
      const abnormalLabs = await database
        .get<LabReport>('lab_reports')
        .query(
          Q.where('is_abnormal', true),
          Q.where('reported_at', Q.gte(sevenDaysAgo)),
        )
        .fetch()

      for (const lab of abnormalLabs) {
        // Find patient for display
        const p = await database.get<Patient>('patients').find(lab.patientId).catch(() => null)
        const label = p?.name ? `${p.name} (MR# ${p.mrNumber})` : p ? `MR# ${p.mrNumber}` : 'Unknown patient'

        const rangeText =
          lab.referenceRangeLow != null && lab.referenceRangeHigh != null
            ? ` (Normal: ${lab.referenceRangeLow}–${lab.referenceRangeHigh} ${lab.unit})`
            : ''

        items.push({
          id: `lab-${lab.id}`,
          type: lab.isCritical ? 'CRITICAL_LAB' : 'ABNORMAL_LAB',
          title: lab.isCritical
            ? `CRITICAL: ${lab.testName} — ${label}`
            : `Abnormal: ${lab.testName} — ${label}`,
          body: `${lab.testName} = ${lab.value} ${lab.unit}${rangeText} on ${fmt(lab.reportedAt)}.`,
          patientId: lab.patientId,
          urgency: lab.isCritical ? 'critical' : 'warning',
          createdAt: lab.reportedAt,
        })
      }

      // Overdue tasks
      const overdueTasks = await database
        .get<Task>('tasks')
        .query(
          Q.where('status', Q.notEq('DONE')),
          Q.where('due_at', Q.notEq(null)),
          Q.where('due_at', Q.lt(now)),
        )
        .fetch()

      for (const task of overdueTasks) {
        const p = await database.get<Patient>('patients').find(task.patientId).catch(() => null)
        const label = p?.name ? `${p.name} (MR# ${p.mrNumber})` : p ? `MR# ${p.mrNumber}` : 'Unknown patient'
        items.push({
          id: `task-${task.id}`,
          type: 'TASK_OVERDUE',
          title: `Overdue Task — ${label}`,
          body: `"${task.title}" was due ${fmt(task.dueAt!)}. Priority: ${task.priority}.`,
          patientId: task.patientId,
          urgency: task.priority === 'HIGH' || task.priority === 'URGENT' ? 'warning' : 'info',
          createdAt: task.dueAt!,
        })
      }

      // Sort: critical first, then by date desc
      items.sort((a, b) => {
        const urgencyOrder = { critical: 0, warning: 1, info: 2 }
        const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
        if (uDiff !== 0) return uDiff
        return b.createdAt - a.createdAt
      })

      setAlerts(items)
    }

    buildAlerts()
    // Refresh every 60s so follow-up dates stay current
    const interval = setInterval(buildAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  return alerts
}

export default function AlertsScreen() {
  const alerts = useAlerts()

  const criticalAlerts = alerts.filter((a) => a.urgency === 'critical')
  const warningAlerts = alerts.filter((a) => a.urgency === 'warning')
  const infoAlerts = alerts.filter((a) => a.urgency === 'info')

  const sections = [
    ...(criticalAlerts.length > 0 ? [{ title: 'Critical', data: criticalAlerts }] : []),
    ...(warningAlerts.length > 0 ? [{ title: 'Action Needed', data: warningAlerts }] : []),
    ...(infoAlerts.length > 0 ? [{ title: 'Upcoming', data: infoAlerts }] : []),
  ]

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        {alerts.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{alerts.length}</Text>
          </View>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>All clear</Text>
          <Text style={styles.emptySubtitle}>
            No overdue follow-ups, abnormal labs, or overdue tasks
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const cfg = URGENCY_CONFIG[item.urgency]
            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: cfg.border }]}
                onPress={() => {
                  if (item.patientId) {
                    router.push(`/(app)/patients/${item.patientId}` as any)
                  }
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
                  <Text style={styles.iconEmoji}>{cfg.icon}</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: cfg.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
                  {item.patientId && (
                    <Text style={styles.tapHint}>Tap to open patient record →</Text>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    ...shadow.sm,
  },
  headerTitle: { ...typography.h2 },
  countBadge: {
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: colors.white },

  listContent: { padding: spacing.lg, paddingBottom: 40 },

  sectionHeader: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...shadow.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: spacing.xs, lineHeight: 20 },
  cardBody: { fontSize: 13, color: colors.gray500, lineHeight: 18, marginBottom: spacing.xs },
  tapHint: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyIcon: { fontSize: 56, marginBottom: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.gray700, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.bodySmall, textAlign: 'center', paddingHorizontal: spacing.xxl },
})
