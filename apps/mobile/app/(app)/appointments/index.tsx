import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform, StatusBar, Modal,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppointmentPatient { id: string; mrNumber: string }
interface AppointmentDoctor { id: string; name: string; role: string }

interface Appointment {
  id: string
  patient: AppointmentPatient
  doctor: AppointmentDoctor
  type: string
  status: string
  scheduledAt: string
  durationMins: number
  notes?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  FOLLOW_UP: 'Follow-up',
  REVIEW: 'Review',
  PROCEDURE: 'Procedure',
  CONSULTATION: 'Consult',
  DISCHARGE_REVIEW: 'Discharge',
}

const TYPE_COLOR: Record<string, string> = {
  FOLLOW_UP: colors.primary,
  REVIEW: '#7C3AED',
  PROCEDURE: colors.warning,
  CONSULTATION: colors.success,
  DISCHARGE_REVIEW: colors.gray500,
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: colors.primary,
  COMPLETED: colors.success,
  CANCELLED: colors.danger,
  NO_SHOW: colors.warning,
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(d: string) {
  const dt = new Date(d)
  const now = new Date()
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate()
}

function groupByDate(appts: Appointment[]): Record<string, Appointment[]> {
  const groups: Record<string, Appointment[]> = {}
  for (const a of appts) {
    const key = new Date(a.scheduledAt).toDateString()
    if (!groups[key]) groups[key] = []
    groups[key].push(a)
  }
  return groups
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AppointmentsScreen() {
  const qc = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)

  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setDate(to.getDate() + 30)
  to.setHours(23, 59, 59, 999)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', 'mobile'],
    queryFn: async () => {
      const res = await api.get(`/appointments?from=${from.toISOString()}&to=${to.toISOString()}`)
      return (res.data.data ?? []) as Appointment[]
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/appointments/${id}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      setSelectedAppt(null)
    },
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const appointments = data ?? []
  const todayAppts = appointments.filter((a) => isToday(a.scheduledAt))
  const laterAppts = appointments.filter((a) => !isToday(a.scheduledAt))
  const groups = groupByDate(laterAppts)

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/(app)/appointments/new')}
          activeOpacity={0.8}
        >
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Today section */}
            {todayAppts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>TODAY</Text>
                  <Text style={styles.sectionSub}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                </View>
                <View style={styles.todayBlock}>
                  {todayAppts.map((a) => (
                    <AppointmentCard key={a.id} appt={a} today onPress={() => setSelectedAppt(a)} />
                  ))}
                </View>
              </View>
            )}

            {/* Upcoming grouped */}
            {Object.entries(groups).map(([dateKey, appts]) => (
              <View key={dateKey} style={styles.section}>
                <Text style={styles.dateSectionLabel}>{fmtDate(appts[0].scheduledAt)}</Text>
                {appts.map((a) => (
                  <AppointmentCard key={a.id} appt={a} onPress={() => setSelectedAppt(a)} />
                ))}
              </View>
            ))}

            {appointments.length === 0 && (
              <View style={styles.center}>
                <Text style={styles.emptyIcon}>◷</Text>
                <Text style={styles.emptyText}>No upcoming appointments</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={!!selectedAppt}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAppt(null)}
      >
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            {selectedAppt && (
              <AppointmentDetail
                appt={selectedAppt}
                onClose={() => setSelectedAppt(null)}
                onComplete={() => updateMutation.mutate({ id: selectedAppt.id, status: 'COMPLETED' })}
                onCancel={() => updateMutation.mutate({ id: selectedAppt.id, status: 'CANCELLED' })}
                loading={updateMutation.isPending}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ── Appointment Card ──────────────────────────────────────────────────────────

function AppointmentCard({ appt, today, onPress }: { appt: Appointment; today?: boolean; onPress: () => void }) {
  const typeColor = TYPE_COLOR[appt.type] ?? colors.gray500
  const statusColor = STATUS_COLOR[appt.status] ?? colors.gray400

  return (
    <TouchableOpacity
      style={[card.wrap, today && card.todayWrap]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[card.typeLine, { backgroundColor: typeColor }]} />
      <View style={card.body}>
        <View style={card.row}>
          <Text style={card.mr}>MR# {appt.patient.mrNumber}</Text>
          <View style={[card.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[card.statusText, { color: statusColor }]}>{appt.status}</Text>
          </View>
        </View>
        <View style={card.row}>
          <View style={[card.typeBadge, { backgroundColor: typeColor + '15' }]}>
            <Text style={[card.typeText, { color: typeColor }]}>{TYPE_LABELS[appt.type] ?? appt.type}</Text>
          </View>
          <Text style={card.time}>{fmtTime(appt.scheduledAt)} · {appt.durationMins}min</Text>
        </View>
        <Text style={card.doctor}>Dr. {appt.doctor.name}</Text>
        {appt.notes ? <Text style={card.notes} numberOfLines={1}>{appt.notes}</Text> : null}
      </View>
    </TouchableOpacity>
  )
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    flexDirection: 'row',
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  todayWrap: { borderWidth: 1.5, borderColor: colors.primary + '40' },
  typeLine: { width: 4 },
  body: { flex: 1, padding: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  mr: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  typeBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  typeText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 12, color: colors.gray500, fontWeight: '600' },
  doctor: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  notes: { fontSize: 12, color: colors.gray400, marginTop: 4 },
})

// ── Detail Modal ──────────────────────────────────────────────────────────────

function AppointmentDetail({ appt, onClose, onComplete, onCancel, loading }: {
  appt: Appointment
  onClose: () => void
  onComplete: () => void
  onCancel: () => void
  loading: boolean
}) {
  const isActive = appt.status === 'SCHEDULED'

  return (
    <View>
      <View style={modal.handle} />
      <View style={modal.headerRow}>
        <Text style={modal.title}>Appointment Details</Text>
        <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
          <Text style={modal.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={modal.infoBlock}>
        <DetailRow label="Patient" value={`MR# ${appt.patient.mrNumber}`} />
        <DetailRow label="Doctor" value={`Dr. ${appt.doctor.name}`} />
        <DetailRow label="Type" value={TYPE_LABELS[appt.type] ?? appt.type} />
        <DetailRow label="Status" value={appt.status} />
        <DetailRow label="Date" value={new Date(appt.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
        <DetailRow label="Time" value={`${fmtTime(appt.scheduledAt)} (${appt.durationMins} min)`} />
        {appt.notes && <DetailRow label="Notes" value={appt.notes} />}
      </View>

      {isActive && (
        <View style={modal.actions}>
          <TouchableOpacity
            style={[modal.actionBtn, { backgroundColor: colors.success }]}
            onPress={onComplete}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={modal.actionText}>Mark Complete</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[modal.actionBtn, { backgroundColor: colors.danger }]}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={modal.actionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={modal.detailRow}>
      <Text style={modal.detailLabel}>{label}</Text>
      <Text style={modal.detailValue}>{value}</Text>
    </View>
  )
}

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xxl, overflow: 'hidden' },
  handle: { width: 36, height: 4, backgroundColor: colors.gray200, borderRadius: radius.full, alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  closeBtn: { padding: spacing.sm },
  closeText: { fontSize: 16, color: colors.gray400 },
  infoBlock: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  detailLabel: { fontSize: 13, color: colors.gray500, fontWeight: '600' },
  detailValue: { fontSize: 13, color: colors.gray900, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xxl, paddingTop: spacing.lg },
  actionBtn: { flex: 1, borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center' },
  actionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
})

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.white },
  newBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  newBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, paddingBottom: 48 },
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { ...typography.label, color: colors.primary },
  sectionSub: { fontSize: 12, color: colors.gray500 },
  todayBlock: { backgroundColor: colors.primaryLight + '40', borderRadius: radius.lg, padding: spacing.sm },
  dateSectionLabel: { ...typography.label, marginBottom: spacing.sm, color: colors.gray500 },
  center: { paddingVertical: 48, alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md, opacity: 0.3 },
  emptyText: { fontSize: 14, color: colors.gray400 },
})
