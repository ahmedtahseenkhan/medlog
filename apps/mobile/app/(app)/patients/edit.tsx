import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'
import type { Patient } from '../../../src/types'

const STATUS_OPTIONS = ['ADMITTED', 'DISCHARGED', 'ARCHIVED']
const CONTACT_CHANNELS = ['sms', 'push', 'email', 'whatsapp'] as const
type ContactChannel = typeof CONTACT_CHANNELS[number]
const CHANNEL_LABELS: Record<ContactChannel, string> = { sms: 'SMS', push: 'Push', email: 'Email', whatsapp: 'WhatsApp' }

export default function EditPatientScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const qc = useQueryClient()

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`)
      return (res.data.data ?? res.data) as Patient
    },
  })

  const [mrNumber, setMrNumber] = useState('')
  const [admissionDiagnosis, setAdmissionDiagnosis] = useState('')
  const [wardName, setWardName] = useState('')
  const [bedNumber, setBedNumber] = useState('')
  const [status, setStatus] = useState('ADMITTED')
  const [contactChannel, setContactChannel] = useState<ContactChannel>('email')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (patient) {
      setMrNumber(patient.mrNumber ?? '')
      setAdmissionDiagnosis(patient.admissionDiagnosis ?? '')
      setWardName((patient as any).wardName ?? patient.wardId ?? '')
      setBedNumber(patient.bedNumber ?? '')
      setStatus(patient.status ?? 'ADMITTED')
      const ch = (patient as any).contactPrefs?.channel
      if (ch && CONTACT_CHANNELS.includes(ch)) setContactChannel(ch as ContactChannel)
    }
  }, [patient])

  async function handleSave() {
    setSaving(true)
    try {
      await api.patch(`/patients/${patientId}`, {
        admissionDiagnosis: admissionDiagnosis.trim() || undefined,
        wardName: wardName.trim() || undefined,
        bedNumber: bedNumber.trim() || undefined,
        status,
        contactPrefs: { channel: contactChannel },
      })
      await qc.invalidateQueries({ queryKey: ['patient', patientId] })
      await qc.invalidateQueries({ queryKey: ['patients'] })
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to update patient')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.primary} /></View>

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Edit Patient</Text>
          <Text style={styles.headerSub}>MR# {mrNumber}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Patient Information</Text>
        <View style={styles.card}>
          <Field label="MR Number" value={mrNumber} onChangeText={setMrNumber} placeholder="MR Number" editable={false} />
          <Divider />
          <Field label="Admission Diagnosis" value={admissionDiagnosis} onChangeText={setAdmissionDiagnosis} placeholder="e.g. Community-acquired pneumonia" multiline />
          <Divider />
          <Field label="Ward" value={wardName} onChangeText={setWardName} placeholder="e.g. Cardiology, ICU, Surgical" />
          <Divider />
          <Field label="Bed Number" value={bedNumber} onChangeText={setBedNumber} placeholder="e.g. 12A" />
        </View>

        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.segmentRow}>
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segment, status === s && styles.segmentActive]}
              onPress={() => setStatus(s)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Contact Preference</Text>
        <View style={styles.segmentRow}>
          {CONTACT_CHANNELS.map((ch) => (
            <TouchableOpacity
              key={ch}
              style={[styles.segment, contactChannel === ch && styles.segmentActive]}
              onPress={() => setContactChannel(ch)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, contactChannel === ch && styles.segmentTextActive]}>
                {CHANNEL_LABELS[ch]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({ label, value, onChangeText, placeholder, multiline, editable = true }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean; editable?: boolean }) {
  return (
    <View style={{ paddingVertical: spacing.md }}>
      <Text style={[typography.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <TextInput
        style={[{ fontSize: 15, color: editable ? colors.gray900 : colors.gray400, minHeight: 32 }, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray300}
        multiline={multiline}
        editable={editable}
      />
    </View>
  )
}
function Divider() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200 }} /> }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { ...typography.h3, color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  body: { padding: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.sm },
  segmentRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.xs, ...shadow.sm },
  segment: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.md },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  segmentTextActive: { color: colors.white },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl, backgroundColor: colors.screenBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
