import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import { scheduleFollowUpReminder, cancelNotification } from '../../../src/services/notifications'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

const STATUS_OPTIONS = ['ADMITTED', 'CRITICAL', 'DISCHARGED']

export default function NewPatientScreen() {
  const [mrNumber, setMrNumber] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [admissionDiagnosis, setAdmissionDiagnosis] = useState('')
  const [wardName, setWardName] = useState('')
  const [bedNumber, setBedNumber] = useState('')
  const [status, setStatus] = useState('ADMITTED')
  const [followUpDateStr, setFollowUpDateStr] = useState('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function parseFollowUpDate(): Date | null {
    if (!followUpDateStr.trim()) return null
    // Accept DD/MM/YYYY or YYYY-MM-DD
    const parts = followUpDateStr.trim().split(/[\/\-]/)
    if (parts.length === 3) {
      let d: Date
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
      } else {
        // DD/MM/YYYY
        d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      if (!isNaN(d.getTime())) return d
    }
    return null
  }

  async function handleSave() {
    if (!mrNumber.trim()) {
      Alert.alert('Required', 'MR Number is required')
      return
    }
    const followUpDate = parseFollowUpDate()
    if (followUpDateStr.trim() && !followUpDate) {
      Alert.alert('Invalid Date', 'Enter follow-up date as DD/MM/YYYY or YYYY-MM-DD')
      return
    }
    setSaving(true)
    try {
      let notifId: string | null = null
      if (followUpDate) {
        notifId = await scheduleFollowUpReminder(
          mrNumber.trim(),
          name.trim() || null,
          followUpDate,
        )
      }

      await database.write(async () => {
        await database.get<Patient>('patients').create((p) => {
          p.mrNumber = mrNumber.trim()
          p.name = name.trim() || null
          p.phone = phone.trim() || null
          p.status = status
          p.wardId = wardName.trim() || null
          p.bedNumber = bedNumber.trim() || null
          p.admissionDate = Date.now()
          p.admissionDiagnosis = admissionDiagnosis.trim() || null
          p.teamId = null
          p.serverId = null
          p.syncedAt = null
          p.followUpDate = followUpDate ? followUpDate.getTime() : null
          p.followUpNotes = followUpNotes.trim() || null
          p.followUpNotifId = notifId
        })
      })

      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to add patient')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Patient</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        <Text style={styles.sectionLabel}>Patient Identity</Text>
        <View style={styles.card}>
          <Field label="MR Number *" value={mrNumber} onChangeText={setMrNumber} placeholder="e.g. MR-2024-001" autoCapitalize="characters" />
          <Divider />
          <Field label="Patient Name" value={name} onChangeText={setName} placeholder="Full name (optional)" autoCapitalize="words" />
          <Divider />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="e.g. +968 9123 4567" keyboardType="phone-pad" />
        </View>

        <Text style={styles.sectionLabel}>Admission Details</Text>
        <View style={styles.card}>
          <Field label="Admission Diagnosis" value={admissionDiagnosis} onChangeText={setAdmissionDiagnosis} placeholder="e.g. Acute MI, Pneumonia" multiline />
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
              style={[
                styles.segment,
                status === s && styles.segmentActive,
                s === 'CRITICAL' && status === s && styles.segmentCritical,
              ]}
              onPress={() => setStatus(s)}
              activeOpacity={0.75}
            >
              <Text style={[styles.segmentText, status === s && styles.segmentTextActive]}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Follow-up Reminder</Text>
        <View style={styles.card}>
          <View style={styles.followUpHint}>
            <Text style={styles.followUpHintIcon}>🔔</Text>
            <Text style={styles.followUpHintText}>
              Set a date and the app will remind you on that morning to check if the patient has arrived.
            </Text>
          </View>
          <Divider />
          <Field
            label="Follow-up Date"
            value={followUpDateStr}
            onChangeText={setFollowUpDateStr}
            placeholder="DD/MM/YYYY or YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
          />
          <Divider />
          <Field
            label="Follow-up Notes"
            value={followUpNotes}
            onChangeText={setFollowUpNotes}
            placeholder="e.g. Review INR, repeat ECG, wound check"
            multiline
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Add Patient</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({
  label, value, onChangeText, placeholder, multiline, autoCapitalize, keyboardType,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  multiline?: boolean
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: any
}) {
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <TextInput
        style={[field.input, multiline && field.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray300}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType}
        returnKeyType={multiline ? 'default' : 'next'}
      />
    </View>
  )
}

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, marginHorizontal: -spacing.lg }} />
}

const field = StyleSheet.create({
  wrap: { paddingVertical: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs },
  input: { fontSize: 15, color: colors.gray900, paddingVertical: spacing.xs, minHeight: 32 },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
})

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
  backBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600', marginTop: -2 },
  headerTitle: { ...typography.h3, color: colors.white },

  body: { padding: spacing.xxl },

  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.sm,
  },

  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xs,
    ...shadow.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentCritical: { backgroundColor: colors.danger },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  segmentTextActive: { color: colors.white },

  followUpHint: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'flex-start',
  },
  followUpHintIcon: { fontSize: 16 },
  followUpHintText: { flex: 1, fontSize: 13, color: colors.gray500, lineHeight: 18 },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl,
    backgroundColor: colors.screenBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.md,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
