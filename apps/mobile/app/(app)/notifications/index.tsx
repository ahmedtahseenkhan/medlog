import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, SectionList, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import type { LabReport } from '../../../src/db/models/LabReport'
import type { Task } from '../../../src/db/models/Task'
import { colors, spacing, radius, shadow } from '../../../src/theme'
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
  critical: { bg: colors.criticalBg,  border: colors.critical, icon: '🚨', iconBg: '#FECACA', text: '#991B1B', label: 'Critical' },
  warning:  { bg: colors.warningLight, border: colors.warning,  icon: '⚠️', iconBg: '#FDE68A', text: '#92400E', label: 'Action Needed' },
  info:     { bg: colors.primaryLight, border: colors.primary,  icon: '🔔', iconBg: colors.primaryMid, text: colors.primaryDark, label: 'Upcoming' },
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
      const items: AlertItem[] = []

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
            id: `fu-overdue-${p.id}`, type: 'FOLLOW_UP_OVERDUE',
            title: `Follow-up Overdue — ${label}`,
            body: `${Math.abs(daysLeft)} day(s) overdue (${fmt(p.followUpDate)}).${p.followUpNotes ? ` ${p.followUpNotes}` : ''} Contact patient or reschedule.`,
            patientId: p.id, urgency: 'warning', createdAt: p.followUpDate,
          })
        } else if (daysLeft === 0) {
          items.push({
            id: `fu-today-${p.id}`, type: 'FOLLOW_UP_TODAY',
            title: `Follow-up Today — ${label}`,
            body: `Check if patient has arrived for their follow-up.${p.followUpNotes ? ` ${p.followUpNotes}` : ''}`,
            patientId: p.id, urgency: 'warning', createdAt: p.followUpDate,
          })
        } else if (daysLeft <= 3) {
          items.push({
            id: `fu-soon-${p.id}`, type: 'FOLLOW_UP_SOON',
            title: `Follow-up in ${daysLeft}d — ${label}`,
            body: `Scheduled ${fmt(p.followUpDate)}.${p.followUpNotes ? ` ${p.followUpNotes}` : ''}`,
            patientId: p.id, urgency: 'info', createdAt: p.followUpDate,
          })
        }
      }

      const abnormalLabs = await database
        .get<LabReport>('lab_reports')
        .query(Q.where('is_abnormal', true), Q.where('reported_at', Q.gte(sevenDaysAgo)))
        .fetch()

      for (const lab of abnormalLabs) {
        const p = await database.get<Patient>('patients').find(lab.patientId).catch(() => null)
        const label = p?.name ? `${p.name} (MR# ${p.mrNumber})` : p ? `MR# ${p.mrNumber}` : 'Unknown patient'
        const rangeText = lab.referenceRangeLow != null && lab.referenceRangeHigh != null
          ? ` (Normal: ${lab.referenceRangeLow}–${lab.referenceRangeHigh} ${lab.unit})` : ''
        items.push({
          id: `lab-${lab.id}`,
          type: lab.isCritical ? 'CRITICAL_LAB' : 'ABNORMAL_LAB',
          title: lab.isCritical ? `CRITICAL: ${lab.testName} — ${label}` : `Abnormal: ${lab.testName} — ${label}`,
          body: `${lab.testName} = ${lab.value} ${lab.unit}${rangeText} on ${fmt(lab.reportedAt)}.`,
          patientId: lab.patientId,
          urgency: lab.isCritical ? 'critical' : 'warning',
          createdAt: lab.reportedAt,
        })
      }

      const overdueTasks = await database
        .get<Task>('tasks')
        .query(Q.where('status', Q.notEq('DONE')), Q.where('due_at', Q.notEq(null)), Q.where('due_at', Q.lt(now)))
        .fetch()

      for (const task of overdueTasks) {
        const p = await database.get<Patient>('patients').find(task.patientId).catch(() => null)
        const label = p?.name ? `${p.name} (MR# ${p.mrNumber})` : p ? `MR# ${p.mrNumber}` : 'Unknown patient'
        items.push({
          id: `task-${task.id}`, type: 'TASK_OVERDUE',
          title: `Overdue Task — ${label}`,
          body: `"${task.title}" was due ${fmt(task.dueAt!)}. Priority: ${task.priority}.`,
          patientId: task.patientId,
          urgency: task.priority === 'HIGH' || task.priority === 'URGENT' ? 'warning' : 'info',
          createdAt: task.dueAt!,
        })
      }

      items.sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 }
        const diff = order[a.urgency] - order[b.urgency]
        return diff !== 0 ? diff : b.createdAt - a.createdAt
      })
      setAlerts(items)
    }

    buildAlerts()
    const interval = setInterval(buildAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  return alerts
}

export default function AlertsScreen() {
  const alerts = useAlerts()

  const criticalAlerts = alerts.filter(a => a.urgency === 'critical')
  const warningAlerts  = alerts.filter(a => a.urgency === 'warning')
  const infoAlerts     = alerts.filter(a => a.urgency === 'info')

  const sections = [
    ...(criticalAlerts.length > 0 ? [{ title: 'critical' as const, data: criticalAlerts }] : []),
    ...(warningAlerts.length  > 0 ? [{ title: 'warning' as const,  data: warningAlerts }] : []),
    ...(infoAlerts.length     > 0 ? [{ title: 'info' as const,     data: infoAlerts }] : []),
  ]

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Teal header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.title}>Alerts</Text>
            <Text style={s.subtitle}>
              {alerts.length === 0 ? 'All clear' : `${alerts.length} active alert${alerts.length > 1 ? 's' : ''}`}
              {criticalAlerts.length > 0 ? <Text style={s.critNote}>  ·  {criticalAlerts.length} critical</Text> : null}
            </Text>
          </View>
          {alerts.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{alerts.length}</Text>
            </View>
          )}
        </View>

        {/* Urgency summary chips */}
        {alerts.length > 0 && (
          <View style={s.chipRow}>
            {criticalAlerts.length > 0 && (
              <View style={[s.chip, { backgroundColor: 'rgba(220,38,38,0.25)', borderColor: 'rgba(252,165,165,0.4)' }]}>
                <Text style={[s.chipText, { color: '#FCA5A5' }]}>🚨 {criticalAlerts.length} critical</Text>
              </View>
            )}
            {warningAlerts.length > 0 && (
              <View style={[s.chip, { backgroundColor: 'rgba(217,119,6,0.25)', borderColor: 'rgba(253,230,138,0.4)' }]}>
                <Text style={[s.chipText, { color: '#FDE68A' }]}>⚠️ {warningAlerts.length} action needed</Text>
              </View>
            )}
            {infoAlerts.length > 0 && (
              <View style={[s.chip, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[s.chipText, { color: 'rgba(255,255,255,0.85)' }]}>🔔 {infoAlerts.length} upcoming</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Text style={{ fontSize: 32 }}>✅</Text>
          </View>
          <Text style={s.emptyTitle}>All clear</Text>
          <Text style={s.emptySubtitle}>No overdue follow-ups, abnormal labs, or overdue tasks right now</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => {
            const cfg = URGENCY_CONFIG[section.title]
            return (
              <View style={s.sectionHeaderRow}>
                <View style={[s.sectionDot, { backgroundColor: cfg.border }]} />
                <Text style={[s.sectionHeader, { color: cfg.border }]}>{cfg.label}</Text>
              </View>
            )
          }}
          renderItem={({ item }) => {
            const cfg = URGENCY_CONFIG[item.urgency]
            return (
              <TouchableOpacity
                style={[s.card, { borderLeftColor: cfg.border }]}
                onPress={() => { if (item.patientId) router.push(`/(app)/patients/${item.patientId}` as any) }}
                activeOpacity={0.75}
              >
                <View style={[s.iconCircle, { backgroundColor: cfg.iconBg }]}>
                  <Text style={s.iconEmoji}>{cfg.icon}</Text>
                </View>
                <View style={s.cardContent}>
                  <Text style={[s.cardTitle, { color: cfg.text }]} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.cardBody} numberOfLines={3}>{item.body}</Text>
                  {item.patientId && <Text style={s.tapHint}>Tap to open patient →</Text>}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
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
    marginBottom: spacing.md,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  critNote: { color: '#FCA5A5', fontWeight: '700' },
  countBadge: {
    backgroundColor: colors.critical,
    borderRadius: radius.full,
    minWidth: 32, height: 32,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: 4,
    ...shadow.sm,
  },
  countBadgeText: { fontSize: 14, fontWeight: '800', color: colors.white },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.xxl, gap: spacing.sm, paddingBottom: spacing.md },
  chip: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700' },

  listContent: { padding: spacing.lg, paddingBottom: 40 },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderLeftWidth: 4,
    ...shadow.md,
  },
  iconCircle: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconEmoji: { fontSize: 20 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: spacing.xs, lineHeight: 20 },
  cardBody: { fontSize: 13, color: colors.textMid, lineHeight: 18, marginBottom: spacing.xs },
  tapHint: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: 14, color: colors.textSoft, textAlign: 'center', paddingHorizontal: spacing.xxl, lineHeight: 20 },
})
