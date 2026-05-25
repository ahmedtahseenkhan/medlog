import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform, StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Vitals } from '../../../src/db/models/Vitals'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// Critical thresholds — auto-alert doctor
const CRITICAL: Record<string, { low?: number; high?: number; message: string }> = {
  spo2:   { low: 94,  message: 'SpO₂ < 94% — Consider O₂ therapy, check airway' },
  hr:     { low: 40, high: 130, message: 'Heart rate abnormal — Check rhythm, fluid status' },
  temp:   { low: 35, high: 39.5, message: 'Temperature abnormal — Sepsis screen if >39.5°C' },
  rr:     { low: 8, high: 30, message: 'Respiratory rate abnormal — Urgent assessment' },
  sbp:    { low: 90, high: 180, message: 'Systolic BP abnormal — Haemodynamic assessment' },
}

function isCritical(key: string, val: number): boolean {
  const c = CRITICAL[key]
  if (!c) return false
  if (c.low !== undefined && val < c.low) return true
  if (c.high !== undefined && val > c.high) return true
  return false
}

export default function AddVitalsScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()

  const [sbp, setSbp] = useState('')
  const [dbp, setDbp] = useState('')
  const [hr, setHr] = useState('')
  const [temp, setTemp] = useState('')
  const [spo2, setSpo2] = useState('')
  const [rr, setRr] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Live critical detection
  const alerts: string[] = []
  if (sbp && isCritical('sbp', parseFloat(sbp))) alerts.push(CRITICAL.sbp.message)
  if (hr && isCritical('hr', parseFloat(hr))) alerts.push(CRITICAL.hr.message)
  if (temp && isCritical('temp', parseFloat(temp))) alerts.push(CRITICAL.temp.message)
  if (spo2 && isCritical('spo2', parseFloat(spo2))) alerts.push(CRITICAL.spo2.message)
  if (rr && isCritical('rr', parseFloat(rr))) alerts.push(CRITICAL.rr.message)

  async function handleSave() {
    const hasAny = sbp || dbp || hr || temp || spo2 || rr
    if (!hasAny) { Alert.alert('Nothing to save', 'Enter at least one vital sign'); return }

    setSaving(true)
    try {
      await database.write(async () => {
        await database.get<Vitals>('vitals').create(v => {
          v.patientId = patientId
          v.bpSystolic = sbp ? parseFloat(sbp) : null
          v.bpDiastolic = dbp ? parseFloat(dbp) : null
          v.heartRate = hr ? parseFloat(hr) : null
          v.temperature = temp ? parseFloat(temp) : null
          v.spo2 = spo2 ? parseFloat(spo2) : null
          v.respiratoryRate = rr ? parseFloat(rr) : null
          v.recordedAt = Date.now()
          v.notes = notes.trim() || null
        })
      })

      if (alerts.length > 0) {
        Alert.alert(
          '⚠️ Critical Values Detected',
          alerts.join('\n\n'),
          [{ text: 'Acknowledged', onPress: () => router.back() }]
        )
      } else {
        router.back()
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Record Vitals</Text>
          <Text style={styles.headerSub}>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Live critical alerts */}
        {alerts.length > 0 && (
          <View style={styles.criticalBanner}>
            <Text style={styles.criticalBannerTitle}>⚠️ Critical Values</Text>
            {alerts.map((a, i) => <Text key={i} style={styles.criticalBannerText}>• {a}</Text>)}
          </View>
        )}

        {/* BP row */}
        <Text style={styles.sectionLabel}>Blood Pressure</Text>
        <View style={[styles.card, styles.bpRow]}>
          <View style={styles.bpHalf}>
            <Text style={styles.vitalLabel}>Systolic</Text>
            <TextInput
              style={[styles.vitalInput, sbp && isCritical('sbp', parseFloat(sbp)) && styles.vitalInputCritical]}
              value={sbp} onChangeText={setSbp}
              keyboardType="number-pad" placeholder="120" placeholderTextColor={colors.gray300}
            />
            <Text style={styles.vitalUnit}>mmHg</Text>
          </View>
          <Text style={styles.bpDivider}>/</Text>
          <View style={styles.bpHalf}>
            <Text style={styles.vitalLabel}>Diastolic</Text>
            <TextInput
              style={styles.vitalInput}
              value={dbp} onChangeText={setDbp}
              keyboardType="number-pad" placeholder="80" placeholderTextColor={colors.gray300}
            />
            <Text style={styles.vitalUnit}>mmHg</Text>
          </View>
        </View>

        {/* Grid of other vitals */}
        <Text style={styles.sectionLabel}>Other Vitals</Text>
        <View style={styles.vitalGrid}>
          <VitalCard label="Heart Rate" unit="bpm" icon="💓" value={hr} onChange={setHr}
            critical={hr && isCritical('hr', parseFloat(hr))} normal="60–100" />
          <VitalCard label="Temperature" unit="°C" icon="🌡️" value={temp} onChange={setTemp}
            critical={temp && isCritical('temp', parseFloat(temp))} normal="36.1–37.2" decimal />
          <VitalCard label="SpO₂" unit="%" icon="🫁" value={spo2} onChange={setSpo2}
            critical={spo2 && isCritical('spo2', parseFloat(spo2))} normal="≥ 95" />
          <VitalCard label="Resp. Rate" unit="/min" icon="🌬️" value={rr} onChange={setRr}
            critical={rr && isCritical('rr', parseFloat(rr))} normal="12–20" />
        </View>

        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.notesInput}
            value={notes} onChangeText={setNotes}
            placeholder="e.g. Patient looks comfortable, on 2L O₂..."
            placeholderTextColor={colors.gray300}
            multiline textAlignVertical="top"
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {alerts.length > 0 && (
          <Text style={styles.footerAlert}>⚠️ {alerts.length} critical value{alerts.length > 1 ? 's' : ''} — will alert on save</Text>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, alerts.length > 0 && styles.saveBtnCritical]}
          onPress={handleSave} disabled={saving} activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Vitals'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function VitalCard({ label, unit, icon, value, onChange, critical, normal, decimal }: {
  label: string; unit: string; icon: string; value: string
  onChange: (v: string) => void; critical?: any; normal: string; decimal?: boolean
}) {
  return (
    <View style={[vc.card, critical && vc.cardCritical]}>
      <View style={vc.top}>
        <Text style={vc.icon}>{icon}</Text>
        <Text style={vc.normal}>{normal}</Text>
      </View>
      <TextInput
        style={[vc.input, critical && vc.inputCritical]}
        value={value} onChangeText={onChange}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholder="—" placeholderTextColor={colors.gray300}
      />
      <Text style={vc.label}>{label}</Text>
      <Text style={vc.unit}>{unit}</Text>
    </View>
  )
}

const vc = StyleSheet.create({
  card: { width: '47%', backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', ...shadow.sm, borderWidth: 1.5, borderColor: colors.gray200 },
  cardCritical: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: spacing.xs },
  icon: { fontSize: 18 },
  normal: { fontSize: 10, color: colors.gray400, fontWeight: '500' },
  input: { fontSize: 28, fontWeight: '800', color: colors.gray900, textAlign: 'center', width: '100%', paddingVertical: spacing.xs },
  inputCritical: { color: colors.danger },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMid, marginTop: 2 },
  unit: { fontSize: 11, color: colors.gray400 },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: spacing.lg, paddingHorizontal: spacing.xl,
  },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { ...typography.h3, color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 2 },

  body: { padding: spacing.xl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },

  criticalBanner: { backgroundColor: colors.dangerLight, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.danger, marginBottom: spacing.lg },
  criticalBannerTitle: { fontSize: 15, fontWeight: '800', color: colors.danger, marginBottom: spacing.sm },
  criticalBannerText: { fontSize: 13, color: '#991B1B', lineHeight: 20, marginBottom: 2 },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.sm },
  bpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  bpHalf: { flex: 1, alignItems: 'center' },
  bpDivider: { fontSize: 36, fontWeight: '300', color: colors.gray300, paddingHorizontal: spacing.md },
  vitalLabel: { ...typography.label, marginBottom: spacing.xs },
  vitalInput: { fontSize: 32, fontWeight: '800', color: colors.gray900, textAlign: 'center', width: '100%', paddingVertical: spacing.xs, borderBottomWidth: 2, borderBottomColor: colors.gray200 },
  vitalInputCritical: { color: colors.danger, borderBottomColor: colors.danger },
  vitalUnit: { fontSize: 12, color: colors.gray400, marginTop: 4 },

  vitalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  notesInput: { fontSize: 14, color: colors.gray900, minHeight: 80, lineHeight: 22 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xl, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xl, backgroundColor: colors.screenBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  footerAlert: { fontSize: 12, color: colors.danger, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnCritical: { backgroundColor: colors.danger },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
