import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

const ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'PR', 'SL']
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QDS', 'Stat', 'PRN', 'Nocte', 'Mane']

export default function AddMedScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const qc = useQueryClient()
  const [drugName, setDrugName] = useState('')
  const [dose, setDose] = useState('')
  const [route, setRoute] = useState('Oral')
  const [frequency, setFrequency] = useState('OD')
  const [isPrn, setIsPrn] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!drugName.trim()) { Alert.alert('Required', 'Drug name is required'); return }
    if (!dose.trim()) { Alert.alert('Required', 'Dose is required'); return }
    setSaving(true)
    try {
      await api.post('/medications', {
        patientId,
        drugName: drugName.trim(),
        dose: dose.trim(),
        route,
        frequency: isPrn ? 'PRN' : frequency,
        startDate: new Date().toISOString(),
        isPrn,
      })
      await qc.invalidateQueries({ queryKey: ['meds', patientId] })
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to add medication')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.success} />
      <View style={[styles.header, { backgroundColor: colors.success }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Medication</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Drug Details</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>Drug Name *</Text>
            <TextInput style={styles.input} value={drugName} onChangeText={setDrugName} placeholder="e.g. Amoxicillin, Metformin" placeholderTextColor={colors.gray300} autoCapitalize="words" />
          </View>
          <Divider />
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>Dose *</Text>
            <TextInput style={styles.input} value={dose} onChangeText={setDose} placeholder="e.g. 500mg, 1g" placeholderTextColor={colors.gray300} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Route</Text>
        <View style={styles.pillGrid}>
          {ROUTES.map((r) => (
            <TouchableOpacity key={r} style={[styles.pill, route === r && styles.pillActive]} onPress={() => setRoute(r)} activeOpacity={0.75}>
              <Text style={[styles.pillText, route === r && styles.pillTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Frequency</Text>
        <View style={styles.pillGrid}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity key={f} style={[styles.pill, frequency === f && styles.pillActive]} onPress={() => setFrequency(f)} activeOpacity={0.75}>
              <Text style={[styles.pillText, frequency === f && styles.pillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.prnToggle} onPress={() => setIsPrn(!isPrn)} activeOpacity={0.75}>
          <View style={[styles.checkbox, isPrn && styles.checkboxActive]}>
            {isPrn && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <View>
            <Text style={styles.prnLabel}>PRN (as needed)</Text>
            <Text style={styles.prnSub}>Only given when patient requires it</Text>
          </View>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.success }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Add Medication</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Divider() { return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200 }} /> }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: spacing.lg, paddingHorizontal: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { ...typography.h3, color: colors.white },
  body: { padding: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.md },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.sm },
  input: { fontSize: 15, color: colors.gray900, minHeight: 32 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  pill: { borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.gray200, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.white },
  pillActive: { backgroundColor: colors.success, borderColor: colors.success },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  pillTextActive: { color: colors.white },
  prnToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, ...shadow.sm },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.gray300, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: colors.success, borderColor: colors.success },
  checkmark: { fontSize: 13, color: colors.white, fontWeight: '700' },
  prnLabel: { fontSize: 15, fontWeight: '600', color: colors.gray900 },
  prnSub: { fontSize: 12, color: colors.gray400, marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl, backgroundColor: colors.screenBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  saveBtn: { borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
