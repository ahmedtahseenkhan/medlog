import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { database } from '../../../src/db/database'
import type { LabReport } from '../../../src/db/models/LabReport'
import type { Patient } from '../../../src/db/models/Patient'
import { fireAbnormalLabAlert } from '../../../src/services/notifications'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

const COMMON_TESTS = [
  'WBC', 'RBC', 'Haemoglobin', 'Platelets', 'Sodium', 'Potassium',
  'Creatinine', 'Urea', 'ALT', 'AST', 'Bilirubin', 'CRP', 'ESR',
  'HbA1c', 'Blood Glucose', 'eGFR',
]

// Default reference ranges for quick auto-fill
const DEFAULT_RANGES: Record<string, { low: number; high: number; unit: string }> = {
  WBC: { low: 4.0, high: 11.0, unit: 'x10⁹/L' },
  RBC: { low: 4.5, high: 5.5, unit: 'x10¹²/L' },
  Haemoglobin: { low: 12.0, high: 17.0, unit: 'g/dL' },
  Platelets: { low: 150, high: 400, unit: 'x10⁹/L' },
  Sodium: { low: 135, high: 145, unit: 'mmol/L' },
  Potassium: { low: 3.5, high: 5.0, unit: 'mmol/L' },
  Creatinine: { low: 62, high: 106, unit: 'µmol/L' },
  Urea: { low: 2.5, high: 7.5, unit: 'mmol/L' },
  ALT: { low: 7, high: 56, unit: 'U/L' },
  AST: { low: 10, high: 40, unit: 'U/L' },
  Bilirubin: { low: 5, high: 21, unit: 'µmol/L' },
  CRP: { low: 0, high: 10, unit: 'mg/L' },
  HbA1c: { low: 4.0, high: 5.7, unit: '%' },
  'Blood Glucose': { low: 3.9, high: 7.8, unit: 'mmol/L' },
  eGFR: { low: 60, high: 120, unit: 'mL/min' },
}

export default function AddLabScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const [patient, setPatient] = useState<Patient | null>(null)

  const [testName, setTestName] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [refLow, setRefLow] = useState('')
  const [refHigh, setRefHigh] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!patientId) return
    database.get<Patient>('patients').find(patientId).then(setPatient).catch(() => {})
  }, [patientId])

  function handleSelectTest(test: string) {
    setTestName(test)
    const defaults = DEFAULT_RANGES[test]
    if (defaults) {
      setUnit(defaults.unit)
      setRefLow(String(defaults.low))
      setRefHigh(String(defaults.high))
    }
  }

  function computeAbnormal(): { isAbnormal: boolean; isCritical: boolean } {
    const num = parseFloat(value)
    const low = parseFloat(refLow)
    const high = parseFloat(refHigh)
    if (isNaN(num) || isNaN(low) || isNaN(high)) {
      return { isAbnormal: false, isCritical: false }
    }
    const isAbnormal = num < low || num > high
    const isCritical = num < low * 0.6 || num > high * 1.5
    return { isAbnormal, isCritical }
  }

  async function handleSave() {
    if (!testName.trim()) { Alert.alert('Required', 'Test name is required'); return }
    if (!value.trim()) { Alert.alert('Required', 'Value is required'); return }
    if (!patientId) { Alert.alert('Error', 'No patient selected'); return }

    setSaving(true)
    try {
      const refLowNum = refLow ? parseFloat(refLow) : null
      const refHighNum = refHigh ? parseFloat(refHigh) : null
      const { isAbnormal, isCritical } = computeAbnormal()

      let notifId: string | null = null
      if (isAbnormal && patient) {
        notifId = await fireAbnormalLabAlert(
          testName.trim(),
          value.trim(),
          unit.trim(),
          refLowNum,
          refHighNum,
          patient.mrNumber,
          patient.name,
        )
      }

      await database.write(async () => {
        await database.get<LabReport>('lab_reports').create((lab) => {
          lab.patientId = patientId
          lab.testName = testName.trim()
          lab.value = value.trim()
          lab.unit = unit.trim()
          lab.referenceRangeLow = refLowNum
          lab.referenceRangeHigh = refHighNum
          lab.isAbnormal = isAbnormal
          lab.isCritical = isCritical
          lab.reportedAt = Date.now()
          lab.serverId = null
          lab.syncedAt = null
          lab.localOnly = true
          lab.notificationId = notifId
        })
      })

      if (isAbnormal) {
        Alert.alert(
          isCritical ? 'CRITICAL Result Saved' : 'Abnormal Result Saved',
          `${testName} = ${value} ${unit} is ${isCritical ? 'critically' : ''} outside the normal range. An alert has been sent.`,
          [{ text: 'OK', onPress: () => router.back() }],
        )
      } else {
        router.back()
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save lab result')
    } finally {
      setSaving(false)
    }
  }

  const { isAbnormal, isCritical } = computeAbnormal()

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Add Lab Result</Text>
          {patient?.name || patient?.mrNumber ? (
            <Text style={styles.headerSub}>{patient.name ?? `MR# ${patient.mrNumber}`}</Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Common Tests</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {COMMON_TESTS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, testName === t && styles.chipActive]}
              onPress={() => handleSelectTest(t)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, testName === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Test Details</Text>
        <View style={styles.card}>
          <Field label="Test Name *" value={testName} onChangeText={setTestName} placeholder="e.g. WBC, Creatinine" />
          <Divider />
          <View style={styles.row}>
            <View style={{ flex: 1.5 }}>
              <Field label="Value *" value={value} onChangeText={setValue} placeholder="e.g. 14.2" keyboardType="decimal-pad" />
            </View>
            <View style={styles.rowDivider} />
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="e.g. g/dL" />
            </View>
          </View>
          <Divider />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Ref Low" value={refLow} onChangeText={setRefLow} placeholder="e.g. 4.0" keyboardType="decimal-pad" />
            </View>
            <View style={styles.rowDivider} />
            <View style={{ flex: 1 }}>
              <Field label="Ref High" value={refHigh} onChangeText={setRefHigh} placeholder="e.g. 11.0" keyboardType="decimal-pad" />
            </View>
          </View>
        </View>

        {/* Live abnormal indicator */}
        {value && refLow && refHigh && isAbnormal && (
          <View style={[styles.alertBanner, isCritical ? styles.alertBannerCritical : styles.alertBannerAbnormal]}>
            <Text style={styles.alertBannerIcon}>{isCritical ? '🚨' : '⚠️'}</Text>
            <Text style={styles.alertBannerText}>
              {isCritical ? 'CRITICAL VALUE' : 'ABNORMAL VALUE'} — an alert will be sent when saved
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, isCritical && value && isAbnormal && styles.saveBtnCritical]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Lab Result</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  keyboardType?: any
}) {
  return (
    <View style={{ paddingVertical: spacing.md }}>
      <Text style={[typography.label, { marginBottom: spacing.xs }]}>{label}</Text>
      <TextInput
        style={{ fontSize: 15, color: colors.gray900, minHeight: 28 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray300}
        keyboardType={keyboardType}
      />
    </View>
  )
}

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200 }} />
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
  backBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { ...typography.h3, color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  body: { padding: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },

  chips: { gap: spacing.sm, paddingBottom: spacing.md },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  chipTextActive: { color: colors.white },

  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.gray200, alignSelf: 'stretch' },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  alertBannerAbnormal: { backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning },
  alertBannerCritical: { backgroundColor: colors.dangerLight, borderWidth: 1.5, borderColor: colors.danger },
  alertBannerIcon: { fontSize: 20 },
  alertBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.gray900 },

  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl,
    backgroundColor: colors.screenBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnCritical: { backgroundColor: colors.danger },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
