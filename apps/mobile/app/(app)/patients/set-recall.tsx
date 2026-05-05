import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

export default function SetRecallScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const qc = useQueryClient()

  const [intervalDays, setIntervalDays] = useState('')
  const [diagnosisNote, setDiagnosisNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const days = parseInt(intervalDays)
      if (!days || days < 1) throw new Error('Please enter a valid interval (minimum 1 day)')
      if (!patientId) throw new Error('Patient ID missing')
      await api.post(`/recall/patient/${patientId}`, {
        intervalDays: days,
        diagnosisNote: diagnosisNote.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recall', patientId] })
      Alert.alert('Success', 'Recall reminder set successfully', [
        { text: 'OK', onPress: () => router.back() },
      ])
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message ?? err?.response?.data?.message ?? 'Failed to set recall')
    },
  })

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Recall Reminder</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Recall Reminder</Text>
          <Text style={styles.infoText}>
            Set a recurring recall interval for this patient. You'll be reminded when the next recall is due.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Interval</Text>
        <View style={styles.card}>
          <View style={{ paddingVertical: spacing.md }}>
            <Text style={[typography.label, { marginBottom: spacing.xs }]}>Interval Days</Text>
            <View style={styles.intervalRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={intervalDays}
                onChangeText={setIntervalDays}
                placeholder="e.g. 30"
                keyboardType="number-pad"
                placeholderTextColor={colors.gray300}
                autoFocus
              />
              <Text style={styles.daysLabel}>days</Text>
            </View>
            {intervalDays ? (
              <Text style={styles.hint}>
                Next recall: {(() => {
                  const d = parseInt(intervalDays)
                  if (!d || d < 1) return 'Invalid'
                  const next = new Date()
                  next.setDate(next.getDate() + d)
                  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                })()}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Preset intervals */}
        <Text style={styles.sectionLabel}>Quick Select</Text>
        <View style={styles.presets}>
          {[
            { label: '1 Week', days: 7 },
            { label: '2 Weeks', days: 14 },
            { label: '1 Month', days: 30 },
            { label: '3 Months', days: 90 },
            { label: '6 Months', days: 180 },
            { label: '1 Year', days: 365 },
          ].map(({ label, days }) => (
            <TouchableOpacity
              key={days}
              style={[styles.preset, intervalDays === String(days) && styles.presetActive]}
              onPress={() => setIntervalDays(String(days))}
              activeOpacity={0.75}
            >
              <Text style={[styles.presetText, intervalDays === String(days) && styles.presetTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Diagnosis Note (optional)</Text>
        <View style={styles.card}>
          <TextInput
            style={[styles.input, { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md }]}
            value={diagnosisNote}
            onChangeText={setDiagnosisNote}
            placeholder="Reason for recall, diagnosis context…"
            placeholderTextColor={colors.gray300}
            multiline
          />
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, (!intervalDays || mutation.isPending) && { opacity: 0.5 }]}
          onPress={() => mutation.mutate()}
          disabled={!intervalDays || mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.saveBtnText}>Set Recall Reminder</Text>}
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
  infoCard: { backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.primaryDark, marginBottom: spacing.xs },
  infoText: { fontSize: 13, color: colors.primaryDark, lineHeight: 19, opacity: 0.85 },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.lg, ...shadow.sm },
  input: { fontSize: 15, color: colors.gray900, borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  daysLabel: { fontSize: 15, color: colors.gray500, fontWeight: '600' },
  hint: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: { borderWidth: 1.5, borderColor: colors.gray200, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.white },
  presetActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  presetTextActive: { color: colors.white },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xxl, paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl, backgroundColor: colors.screenBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.md },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
