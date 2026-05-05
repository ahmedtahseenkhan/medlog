import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

const APPOINTMENT_TYPES = ['FOLLOW_UP', 'REVIEW', 'PROCEDURE', 'CONSULTATION'] as const
type AppointmentType = typeof APPOINTMENT_TYPES[number]

const TYPE_LABELS: Record<AppointmentType, string> = {
  FOLLOW_UP: 'Follow-up',
  REVIEW: 'Review',
  PROCEDURE: 'Procedure',
  CONSULTATION: 'Consultation',
}

const DURATIONS = [15, 30, 45, 60]

interface Patient { id: string; mrNumber: string; status: string }
interface TeamMember { id: string; name: string; role: string }

export default function NewAppointmentScreen() {
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedPatientMR, setSelectedPatientMR] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [type, setType] = useState<AppointmentType>('FOLLOW_UP')
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState(15)
  const [notes, setNotes] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [showPatientList, setShowPatientList] = useState(false)

  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'admitted'],
    queryFn: async () => {
      const res = await api.get('/patients?status=ADMITTED&pageSize=100')
      return (res.data.data ?? []) as Patient[]
    },
  })

  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const res = await api.get('/teams/members')
      return (res.data.data ?? []) as TeamMember[]
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatientId || !selectedDoctorId || !scheduledAt) {
        throw new Error('Please fill all required fields')
      }
      // Parse datetime from "YYYY-MM-DD HH:MM" format
      const [datePart, timePart] = scheduledAt.trim().split(' ')
      if (!datePart || !timePart) throw new Error('Invalid date format. Use YYYY-MM-DD HH:MM')
      const iso = new Date(`${datePart}T${timePart}:00`).toISOString()
      await api.post('/appointments', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        type,
        scheduledAt: iso,
        durationMins: duration,
        notes: notes.trim() || undefined,
      })
    },
    onSuccess: () => {
      Alert.alert('Success', 'Appointment scheduled successfully', [
        { text: 'OK', onPress: () => router.back() },
      ])
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? err?.response?.data?.message ?? 'Failed to schedule appointment')
    },
  })

  const filteredPatients = (patientsData ?? []).filter((p) =>
    p.mrNumber.toLowerCase().includes(patientSearch.toLowerCase())
  )

  function selectPatient(p: Patient) {
    setSelectedPatientId(p.id)
    setSelectedPatientMR(p.mrNumber)
    setPatientSearch(p.mrNumber)
    setShowPatientList(false)
  }

  const cls = styles.input
  const canSubmit = selectedPatientId && selectedDoctorId && scheduledAt

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Patient picker */}
        <Text style={styles.sectionLabel}>Patient</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>Search by MR#</Text>
            <TextInput
              style={cls}
              value={patientSearch}
              onChangeText={(v) => { setPatientSearch(v); setShowPatientList(true); setSelectedPatientId('') }}
              placeholder="Enter MR number"
              placeholderTextColor={colors.gray300}
              autoCapitalize="none"
            />
            {selectedPatientId ? (
              <Text style={styles.selectedHint}>Selected: MR# {selectedPatientMR}</Text>
            ) : null}
            {showPatientList && filteredPatients.length > 0 && (
              <View style={styles.dropdown}>
                {filteredPatients.slice(0, 8).map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.dropdownItem}
                    onPress={() => selectPatient(p)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownText}>MR# {p.mrNumber}</Text>
                    <Text style={styles.dropdownSub}>{p.status}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Doctor */}
        <Text style={styles.sectionLabel}>Doctor</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.sm }]}>Select Doctor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }}>
              <View style={styles.pillRow}>
                {(teamData ?? []).map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.pill, selectedDoctorId === m.id && styles.pillActive]}
                    onPress={() => setSelectedDoctorId(m.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.pillText, selectedDoctorId === m.id && styles.pillTextActive]} numberOfLines={1}>
                      Dr. {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Type */}
        <Text style={styles.sectionLabel}>Appointment Type</Text>
        <View style={styles.segmentRow}>
          {APPOINTMENT_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segment, type === t && styles.segmentActive]}
              onPress={() => setType(t)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, type === t && styles.segmentTextActive]} numberOfLines={1}>
                {TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date & Time */}
        <Text style={styles.sectionLabel}>Date & Time</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>Date & Time</Text>
            <TextInput
              style={cls}
              value={scheduledAt}
              onChangeText={setScheduledAt}
              placeholder="YYYY-MM-DD HH:MM"
              placeholderTextColor={colors.gray300}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>Format: 2026-05-15 09:30</Text>
          </View>
        </View>

        {/* Duration */}
        <Text style={styles.sectionLabel}>Duration</Text>
        <View style={styles.pillRowCard}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.durationPill, duration === d && styles.durationPillActive]}
              onPress={() => setDuration(d)}
              activeOpacity={0.75}
            >
              <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>{d} min</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <View style={styles.card}>
          <TextInput
            style={[cls, { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.md }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes…"
            placeholderTextColor={colors.gray300}
            multiline
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !canSubmit && { opacity: 0.5 }]}
          onPress={() => mutation.mutate()}
          disabled={!canSubmit || mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.saveBtnText}>Schedule Appointment</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  body: { padding: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.sm },
  input: { fontSize: 15, color: colors.gray900, borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  hint: { fontSize: 11, color: colors.gray400, marginTop: spacing.xs },
  selectedHint: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: spacing.xs },
  dropdown: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200, marginTop: spacing.xs, ...shadow.sm },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  dropdownText: { fontSize: 14, fontWeight: '600', color: colors.gray900 },
  dropdownSub: { fontSize: 12, color: colors.gray400 },
  pillRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm },
  pill: { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  pillTextActive: { color: colors.white },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm, ...shadow.sm },
  segment: { flex: 1, minWidth: '40%', paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gray200 },
  segmentActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '600', color: colors.gray500 },
  segmentTextActive: { color: colors.white },
  pillRowCard: { flexDirection: 'row', gap: spacing.sm },
  durationPill: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.gray200, backgroundColor: colors.white, ...shadow.sm },
  durationPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  durationText: { fontSize: 13, fontWeight: '700', color: colors.gray500 },
  durationTextActive: { color: colors.white },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl, backgroundColor: colors.screenBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
