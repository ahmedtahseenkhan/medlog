import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform, StatusBar, Pressable,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import type { Task } from '../../../src/db/models/Task'
import { scheduleTaskReminder } from '../../../src/services/notifications'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ─── Quick clinical task templates ────────────────────────────────────────────
const TEMPLATES = [
  { label: 'Check vitals',      icon: '💓' },
  { label: 'Review bloods',     icon: '🩸' },
  { label: 'Check result',      icon: '🧪' },
  { label: 'Call family',       icon: '📞' },
  { label: 'Re-assess patient', icon: '👁️' },
  { label: 'Follow up',         icon: '📋' },
  { label: 'Order investigation', icon: '📄' },
  { label: 'Medication review', icon: '💊' },
  { label: 'Discharge prep',    icon: '🏠' },
  { label: 'Wound check',       icon: '🩹' },
]

// ─── Quick time presets ────────────────────────────────────────────────────────
const QUICK_TIMES: { label: string; sublabel: string; minutes: number; priority: string }[] = [
  { label: '30 min',    sublabel: 'Very soon',    minutes: 30,  priority: 'URGENT' },
  { label: '1 hour',    sublabel: 'Soon',         minutes: 60,  priority: 'HIGH' },
  { label: '2 hours',   sublabel: 'After rounds', minutes: 120, priority: 'HIGH' },
  { label: '3 hours',   sublabel: 'This session', minutes: 180, priority: 'MEDIUM' },
  { label: '6 hours',   sublabel: 'Half shift',   minutes: 360, priority: 'MEDIUM' },
  { label: '8 hours',   sublabel: 'End of shift', minutes: 480, priority: 'MEDIUM' },
  { label: 'Tomorrow',  sublabel: '8:00 AM',      minutes: -1,  priority: 'LOW' },
  { label: 'No alarm',  sublabel: 'Track only',   minutes: 0,   priority: 'LOW' },
]

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: '#7C3AED', HIGH: colors.danger, MEDIUM: colors.warning, LOW: colors.gray400,
}

function minutesFromNow(minutes: number): Date {
  if (minutes === -1) {
    // Tomorrow 8am
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(8, 0, 0, 0)
    return d
  }
  return new Date(Date.now() + minutes * 60 * 1000)
}

export default function NewTaskScreen() {
  const { patientId: preselectedPatientId } = useLocalSearchParams<{ patientId?: string }>()

  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customTitle, setCustomTitle] = useState('')
  const [selectedTime, setSelectedTime] = useState<typeof QUICK_TIMES[0] | null>(QUICK_TIMES[1]) // default 1hr
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId ?? '')
  const [patients, setPatients] = useState<Patient[]>([])
  const [showPatientPicker, setShowPatientPicker] = useState(!preselectedPatientId)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    database.get<Patient>('patients').query().fetch().then(setPatients).catch(() => {})
  }, [])

  const title = selectedTemplate || customTitle.trim()
  const selectedPatient = patients.find(p => p.id === selectedPatientId)

  async function handleCreate() {
    if (!title) { Alert.alert('What to do?', 'Pick a task type or type a custom one'); return }
    if (!selectedPatientId) { Alert.alert('Which patient?', 'Select a patient for this task'); return }

    setSaving(true)
    try {
      let dueAt: Date | null = null
      let notifId: string | null = null

      if (selectedTime && selectedTime.minutes !== 0) {
        dueAt = minutesFromNow(selectedTime.minutes)
        if (selectedPatient) {
          notifId = await scheduleTaskReminder(title, selectedPatient.mrNumber, dueAt)
        }
      }

      await database.write(async () => {
        await database.get<Task>('tasks').create((t) => {
          t.patientId = selectedPatientId
          t.title = title
          t.status = 'PENDING'
          t.priority = selectedTime?.priority ?? 'MEDIUM'
          t.dueAt = dueAt ? dueAt.getTime() : null
          t.serverId = null
          t.syncedAt = null
          t.localOnly = true
          t.notificationId = notifId
        })
      })

      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const timeUntilStr = selectedTime
    ? selectedTime.minutes === 0
      ? 'No alarm set'
      : selectedTime.minutes === -1
      ? 'Alarm: Tomorrow 8:00 AM'
      : `Alarm in ${selectedTime.label}`
    : ''

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Task</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Patient selector ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>For which patient?</Text>
          {selectedPatient ? (
            <TouchableOpacity style={styles.selectedPatientCard} onPress={() => setShowPatientPicker(true)} activeOpacity={0.8}>
              <View style={styles.selectedPatientAvatar}>
                <Text style={styles.selectedPatientAvatarText}>{(selectedPatient.name ?? selectedPatient.mrNumber)[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedPatientName}>{selectedPatient.name ?? `MR# ${selectedPatient.mrNumber}`}</Text>
                {selectedPatient.name ? <Text style={styles.selectedPatientMR}>MR# {selectedPatient.mrNumber}</Text> : null}
              </View>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.selectPatientBtn} onPress={() => setShowPatientPicker(true)} activeOpacity={0.8}>
              <Text style={styles.selectPatientBtnText}>👤  Select Patient</Text>
            </TouchableOpacity>
          )}

          {showPatientPicker && patients.length > 0 && (
            <View style={styles.patientList}>
              {patients.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.patientItem, selectedPatientId === p.id && styles.patientItemSelected]}
                  onPress={() => { setSelectedPatientId(p.id); setShowPatientPicker(false) }}
                  activeOpacity={0.75}
                >
                  <View style={styles.patientItemAvatar}>
                    <Text style={styles.patientItemAvatarText}>{(p.name ?? p.mrNumber)[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.patientItemName}>{p.name ?? `MR# ${p.mrNumber}`}</Text>
                    {p.name ? <Text style={styles.patientItemMR}>MR# {p.mrNumber}</Text> : null}
                    {p.admissionDiagnosis ? <Text style={styles.patientItemDx} numberOfLines={1}>{p.admissionDiagnosis}</Text> : null}
                  </View>
                  {selectedPatientId === p.id && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Task templates ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What do you need to do?</Text>
          <View style={styles.templateGrid}>
            {TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t.label}
                style={[styles.templateChip, selectedTemplate === t.label && styles.templateChipSelected]}
                onPress={() => { setSelectedTemplate(selectedTemplate === t.label ? '' : t.label); setCustomTitle('') }}
                activeOpacity={0.75}
              >
                <Text style={styles.templateIcon}>{t.icon}</Text>
                <Text style={[styles.templateLabel, selectedTemplate === t.label && styles.templateLabelSelected]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom input */}
          <TextInput
            style={[styles.customInput, customTitle ? styles.customInputActive : {}]}
            value={customTitle}
            onChangeText={(v) => { setCustomTitle(v); if (v) setSelectedTemplate('') }}
            placeholder="Or type a custom task…"
            placeholderTextColor={colors.gray300}
            returnKeyType="done"
          />
        </View>

        {/* ── Time / alarm ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Set alarm / reminder</Text>
          <View style={styles.timeGrid}>
            {QUICK_TIMES.map((t) => {
              const isSelected = selectedTime?.label === t.label
              const priorityColor = PRIORITY_COLOR[t.priority]
              return (
                <TouchableOpacity
                  key={t.label}
                  style={[
                    styles.timeChip,
                    isSelected && { backgroundColor: priorityColor, borderColor: priorityColor },
                  ]}
                  onPress={() => setSelectedTime(isSelected ? null : t)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.timeChipLabel, isSelected && { color: colors.white }]}>{t.label}</Text>
                  <Text style={[styles.timeChipSub, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>{t.sublabel}</Text>
                  {isSelected && t.minutes !== 0 && (
                    <View style={[styles.urgencyDot, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                      <Text style={{ fontSize: 9, color: colors.white, fontWeight: '800' }}>{t.priority[0]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Floating create button ── */}
      <View style={styles.footer}>
        {/* Summary line */}
        {title && selectedPatient && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText} numberOfLines={1}>
              <Text style={{ fontWeight: '700' }}>{title}</Text>
              {' · '}
              {selectedPatient.name ?? `MR# ${selectedPatient.mrNumber}`}
              {timeUntilStr ? ` · ${timeUntilStr}` : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.createBtn,
            (!title || !selectedPatientId) && styles.createBtnDisabled,
            selectedTime && selectedTime.minutes !== 0 && { backgroundColor: PRIORITY_COLOR[selectedTime.priority] ?? colors.primary },
          ]}
          onPress={handleCreate}
          disabled={saving || !title || !selectedPatientId}
          activeOpacity={0.85}
        >
          <Text style={styles.createBtnIcon}>
            {selectedTime && selectedTime.minutes !== 0 ? '🔔' : '✓'}
          </Text>
          <Text style={styles.createBtnText}>
            {saving
              ? 'Setting…'
              : selectedTime && selectedTime.minutes !== 0
              ? `Set Alarm — ${selectedTime.label}`
              : 'Add Task'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  closeBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: colors.white, fontWeight: '700' },
  headerTitle: { ...typography.h3, color: colors.white },

  body: { padding: spacing.xl },

  section: { marginBottom: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.md },

  // Patient selector
  selectedPatientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, ...shadow.sm },
  selectedPatientAvatar: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  selectedPatientAvatarText: { fontSize: 18, fontWeight: '800', color: colors.white },
  selectedPatientName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  selectedPatientMR: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  changeText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  selectPatientBtn: { backgroundColor: colors.white, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center', borderWidth: 2, borderColor: colors.gray200, borderStyle: 'dashed', ...shadow.sm },
  selectPatientBtnText: { fontSize: 15, fontWeight: '600', color: colors.gray500 },

  patientList: { marginTop: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', ...shadow.md },
  patientItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  patientItemSelected: { backgroundColor: colors.primaryLight },
  patientItemAvatar: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
  patientItemAvatarText: { fontSize: 14, fontWeight: '700', color: colors.textMid },
  patientItemName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  patientItemMR: { fontSize: 12, color: colors.gray500 },
  patientItemDx: { fontSize: 12, color: colors.gray400, marginTop: 1 },

  // Templates
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  templateChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1.5, borderColor: colors.gray200, ...shadow.sm },
  templateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  templateIcon: { fontSize: 15 },
  templateLabel: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  templateLabelSelected: { color: colors.white },

  customInput: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, color: colors.gray900, borderWidth: 1.5, borderColor: colors.gray200, ...shadow.sm },
  customInputActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },

  // Time grid
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    width: '23%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray200,
    ...shadow.sm,
    position: 'relative',
  },
  timeChipLabel: { fontSize: 14, fontWeight: '700', color: colors.gray900, marginBottom: 2 },
  timeChipSub: { fontSize: 10, color: colors.gray400, textAlign: 'center' },
  urgencyDot: { position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xl,
    backgroundColor: colors.screenBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  summaryRow: { marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
  summaryText: { fontSize: 12, color: colors.gray500 },
  createBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadow.md,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnIcon: { fontSize: 18 },
  createBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
})
