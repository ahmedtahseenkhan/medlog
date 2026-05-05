import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Drug {
  name: string
  dose: string
  route: string
  frequency: string
  duration: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUTES = ['Oral', 'IV', 'IM', 'SC']
const FREQUENCIES = ['OD', 'BD', 'TDS', 'QDS', 'PRN', 'Stat']

function emptyDrug(): Drug {
  return { name: '', dose: '', route: 'Oral', frequency: 'OD', duration: '' }
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NewRxScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const [drugs, setDrugs] = useState<Drug[]>([emptyDrug()])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  function updateDrug(idx: number, field: keyof Drug, value: string) {
    setDrugs((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)))
  }

  function addDrug() {
    setDrugs((prev) => [...prev, emptyDrug()])
  }

  function removeDrug(idx: number) {
    setDrugs((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleIssue() {
    // Validate
    const invalid = drugs.find((d) => !d.name.trim() || !d.dose.trim() || !d.duration.trim())
    if (invalid) {
      Alert.alert('Missing fields', 'Please fill in drug name, dose, and duration for all drugs.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        patientId,
        drugs,
        notes: notes.trim() || undefined,
      }
      const res = await api.post('/prescriptions', payload)
      const issued = res.data.data
      Alert.alert(
        'Prescription Issued',
        `Prescription ID: ${issued.id}\nHash: ${issued.hash.slice(0, 12)}…`,
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to issue prescription. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>{'<'}</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Prescription</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Drugs Section */}
        <Text style={styles.sectionLabel}>DRUGS</Text>

        {drugs.map((drug, idx) => (
          <DrugCard
            key={idx}
            drug={drug}
            index={idx}
            onChange={updateDrug}
            onRemove={drugs.length > 1 ? () => removeDrug(idx) : undefined}
          />
        ))}

        <TouchableOpacity style={styles.addDrugBtn} onPress={addDrug} activeOpacity={0.8}>
          <Text style={styles.addDrugText}>+ Add Drug</Text>
        </TouchableOpacity>

        {/* Notes */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Prescriber notes…"
          placeholderTextColor={colors.gray300}
          multiline
          textAlignVertical="top"
        />

        {/* Issue Button */}
        <TouchableOpacity
          style={[styles.issueBtn, loading && styles.issueBtnDisabled]}
          onPress={handleIssue}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.issueBtnText}>Issue Prescription</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

// ── Drug Card ─────────────────────────────────────────────────────────────────

function DrugCard({
  drug,
  index,
  onChange,
  onRemove,
}: {
  drug: Drug
  index: number
  onChange: (idx: number, field: keyof Drug, value: string) => void
  onRemove?: () => void
}) {
  return (
    <View style={dc.card}>
      <View style={dc.cardHeader}>
        <Text style={dc.cardTitle}>Drug {index + 1}</Text>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} activeOpacity={0.7}>
            <Text style={dc.removeText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Drug Name */}
      <Text style={dc.fieldLabel}>Drug Name *</Text>
      <TextInput
        style={dc.input}
        value={drug.name}
        onChangeText={(v) => onChange(index, 'name', v)}
        placeholder="e.g. Amoxicillin"
        placeholderTextColor={colors.gray300}
      />

      {/* Dose */}
      <Text style={dc.fieldLabel}>Dose *</Text>
      <TextInput
        style={dc.input}
        value={drug.dose}
        onChangeText={(v) => onChange(index, 'dose', v)}
        placeholder="e.g. 500mg"
        placeholderTextColor={colors.gray300}
      />

      {/* Route */}
      <Text style={dc.fieldLabel}>Route</Text>
      <View style={dc.pickerRow}>
        {ROUTES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[dc.chip, drug.route === r && dc.chipActive]}
            onPress={() => onChange(index, 'route', r)}
            activeOpacity={0.7}
          >
            <Text style={[dc.chipText, drug.route === r && dc.chipTextActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Frequency */}
      <Text style={dc.fieldLabel}>Frequency</Text>
      <View style={dc.pickerRow}>
        {FREQUENCIES.map((f) => (
          <TouchableOpacity
            key={f}
            style={[dc.chip, drug.frequency === f && dc.chipActive]}
            onPress={() => onChange(index, 'frequency', f)}
            activeOpacity={0.7}
          >
            <Text style={[dc.chipText, drug.frequency === f && dc.chipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Duration */}
      <Text style={dc.fieldLabel}>Duration *</Text>
      <TextInput
        style={dc.input}
        value={drug.duration}
        onChangeText={(v) => onChange(index, 'duration', v)}
        placeholder="e.g. 7 days"
        placeholderTextColor={colors.gray300}
      />
    </View>
  )
}

const dc = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  removeText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.gray500, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.gray900,
    marginBottom: spacing.md,
  },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.white,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  chipTextActive: { color: colors.primary },
})

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 60 },
  backArrow: { fontSize: 18, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  backLabel: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.white },

  scroll: { flex: 1 },
  scrollInner: { padding: spacing.xxl, paddingBottom: 48 },

  sectionLabel: { ...typography.label, marginBottom: spacing.md },

  addDrugBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addDrugText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  notesInput: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.gray900,
    minHeight: 80,
    lineHeight: 22,
    ...shadow.sm,
  },

  issueBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadow.md,
  },
  issueBtnDisabled: { opacity: 0.6 },
  issueBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
