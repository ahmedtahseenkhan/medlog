import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'
import type { Patient } from '../../../src/types'

const NOTE_TYPES = ['FREE_TEXT', 'SOAP', 'PROGRESS'] as const
type NoteType = typeof NOTE_TYPES[number]
const TYPE_LABELS: Record<NoteType, string> = { FREE_TEXT: 'Free Text', SOAP: 'SOAP', PROGRESS: 'Progress' }

export default function NewNoteScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const [noteType, setNoteType] = useState<NoteType>('FREE_TEXT')
  const [freeText, setFreeText] = useState('')
  // SOAP fields
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: patient } = useQuery<Patient | null>({
    queryKey: ['patient', patientId],
    initialData: null,
    queryFn: async () => {
      const res = await api.get(`/patients/${patientId}`)
      return (res.data.data ?? res.data) as Patient
    },
    enabled: !!patientId,
  })

  function buildContent() {
    if (noteType === 'SOAP') {
      return { subjective, objective, assessment, plan }
    }
    return { text: freeText }
  }

  function canSubmit() {
    if (noteType === 'SOAP') {
      return (subjective + objective + assessment + plan).trim().length > 0
    }
    return freeText.trim().length > 0
  }

  const save = useMutation({
    mutationFn: async (isDraft: boolean) => {
      if (!patientId) throw new Error('No patient selected')
      await api.post('/notes', {
        patientId,
        type: noteType,
        content: buildContent(),
        isDraft,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', patientId] })
      router.back()
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to save note'),
  })

  const ready = canSubmit() && !save.isPending

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>{'<'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>New Note</Text>
            {patient && (
              <Text style={styles.patientContext}>MR# {patient.mrNumber}</Text>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Text style={styles.sectionLabel}>Note Type</Text>
          <View style={styles.typeRow}>
            {NOTE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, noteType === t && styles.typePillActive]}
                onPress={() => setNoteType(t)}
                activeOpacity={0.75}
              >
                <Text style={[styles.typePillText, noteType === t && styles.typePillTextActive]}>
                  {TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {noteType === 'SOAP' ? (
            <>
              {([
                { key: 'S', label: 'Subjective', placeholder: "Patient's complaints and history in their own words…", value: subjective, set: setSubjective },
                { key: 'O', label: 'Objective', placeholder: 'Vitals, physical exam findings, lab values…', value: objective, set: setObjective },
                { key: 'A', label: 'Assessment', placeholder: 'Diagnosis or differential diagnoses…', value: assessment, set: setAssessment },
                { key: 'P', label: 'Plan', placeholder: 'Investigations, medications, follow-up instructions…', value: plan, set: setPlan },
              ] as const).map(({ key, label, placeholder, value, set }) => (
                <View key={key} style={styles.soapBlock}>
                  <View style={styles.soapLabelRow}>
                    <View style={styles.soapKey}>
                      <Text style={styles.soapKeyText}>{key}</Text>
                    </View>
                    <Text style={styles.soapLabel}>{label}</Text>
                  </View>
                  <TextInput
                    style={[styles.soapInput, focused === key && styles.inputFocused]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.gray300}
                    value={value}
                    onChangeText={set}
                    multiline
                    textAlignVertical="top"
                    onFocus={() => setFocused(key)}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>
                {noteType === 'PROGRESS' ? 'Progress Note' : 'Clinical Note'}
              </Text>
              <TextInput
                style={[styles.textArea, focused === 'free' && styles.inputFocused]}
                placeholder={
                  noteType === 'PROGRESS'
                    ? 'Document patient progress, response to treatment, clinical changes…'
                    : 'Start typing your clinical note…'
                }
                placeholderTextColor={colors.gray400}
                value={freeText}
                onChangeText={setFreeText}
                multiline
                textAlignVertical="top"
                onFocus={() => setFocused('free')}
                onBlur={() => setFocused(null)}
              />
            </>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.draftBtn, !ready && styles.btnDisabled]}
            onPress={() => save.mutate(true)}
            disabled={!ready}
            activeOpacity={0.8}
          >
            <Text style={styles.draftBtnText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, !ready && styles.btnDisabled]}
            onPress={() => save.mutate(false)}
            disabled={!ready}
            activeOpacity={0.85}
          >
            {save.isPending
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={styles.submitBtnText}>Submit Note</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
    gap: spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.gray100, justifyContent: 'center', alignItems: 'center',
  },
  backArrow: { fontSize: 18, color: colors.gray700, fontWeight: '600' },
  headerTitle: { ...typography.h3 },
  patientContext: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },

  scrollContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xl, paddingBottom: 120 },
  sectionLabel: { ...typography.label, marginBottom: spacing.md, marginTop: spacing.md },

  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  typePill: {
    flex: 1, borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.gray200, paddingVertical: 10,
    alignItems: 'center', backgroundColor: colors.white, ...shadow.sm,
  },
  typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typePillText: { fontSize: 13, fontWeight: '700', color: colors.gray500 },
  typePillTextActive: { color: colors.white },

  soapBlock: { marginBottom: spacing.lg },
  soapLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  soapKey: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  soapKeyText: { fontSize: 14, fontWeight: '800', color: colors.white },
  soapLabel: { ...typography.h4, fontSize: 15 },
  soapInput: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.gray200,
    padding: spacing.lg, fontSize: 15, color: colors.gray900,
    minHeight: 90, lineHeight: 22, ...shadow.sm,
  },
  inputFocused: { borderColor: colors.primary },

  textArea: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.gray200,
    padding: spacing.lg, fontSize: 15, color: colors.gray900,
    minHeight: 260, lineHeight: 24, ...shadow.sm,
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.xl,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
    ...shadow.lg,
  },
  draftBtn: {
    flex: 1, borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.primary, paddingVertical: 14,
    alignItems: 'center', backgroundColor: colors.white,
  },
  draftBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  submitBtn: {
    flex: 1.6, borderRadius: radius.full,
    backgroundColor: colors.primary, paddingVertical: 14,
    alignItems: 'center', ...shadow.sm,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  btnDisabled: { opacity: 0.45 },
})
