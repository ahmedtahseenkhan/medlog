import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../../../src/lib/api'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'
import type { Patient } from '@medlog/types'

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
const PRIORITY_COLORS: Record<string, string> = {
  LOW: colors.gray400,
  MEDIUM: colors.warning,
  HIGH: colors.danger,
  URGENT: '#7C3AED',
}

export default function NewTaskScreen() {
  const { patientId: preselectedPatientId } = useLocalSearchParams<{ patientId?: string }>()
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('MEDIUM')
  const [selectedPatientId, setSelectedPatientId] = useState(preselectedPatientId ?? '')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: patients } = useQuery({
    queryKey: ['patients'],
    initialData: [] as Patient[],
    queryFn: async () => {
      const res = await api.get('/patients?page=1&limit=100&status=ADMITTED')
      return ((res.data.data ?? []) as Patient[])
    },
  })

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Required', 'Task title is required'); return }
    if (!selectedPatientId) { Alert.alert('Required', 'Please select a patient'); return }
    setSaving(true)
    try {
      await api.post('/tasks', {
        patientId: selectedPatientId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      })
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      await qc.invalidateQueries({ queryKey: ['tasks', selectedPatientId] })
      router.back()
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const selectedPatient = patients?.find((p) => p.id === selectedPatientId)

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Task</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        <Text style={styles.sectionLabel}>Task Details</Text>
        <View style={styles.card}>
          <View style={field.wrap}>
            <Text style={field.label}>Title *</Text>
            <TextInput
              style={field.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Check morning vitals, Review CBC results"
              placeholderTextColor={colors.gray300}
              returnKeyType="next"
            />
          </View>
          <Divider />
          <View style={field.wrap}>
            <Text style={field.label}>Description (optional)</Text>
            <TextInput
              style={[field.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Additional instructions or context"
              placeholderTextColor={colors.gray300}
              multiline
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.priorityBtn, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]}
              onPress={() => setPriority(p)}
              activeOpacity={0.75}
            >
              <Text style={[styles.priorityBtnText, priority === p && { color: colors.white }]}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Patient *</Text>
        {preselectedPatientId && selectedPatient ? (
          <View style={styles.card}>
            <View style={[field.wrap, { paddingVertical: spacing.md }]}>
              <Text style={styles.selectedPatientMR}>MR# {selectedPatient.mrNumber}</Text>
              {selectedPatient.admissionDiagnosis ? (
                <Text style={styles.selectedPatientDx}>{selectedPatient.admissionDiagnosis}</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            {(patients ?? []).length === 0 ? (
              <Text style={styles.noPatients}>No admitted patients found</Text>
            ) : (
              (patients ?? []).map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <Divider />}
                  <TouchableOpacity
                    style={styles.patientRow}
                    onPress={() => setSelectedPatientId(p.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.patientRowContent}>
                      <Text style={styles.patientMR}>MR# {p.mrNumber}</Text>
                      {p.admissionDiagnosis ? (
                        <Text style={styles.patientDx} numberOfLines={1}>{p.admissionDiagnosis}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.radio, selectedPatientId === p.id && styles.radioSelected]}>
                      {selectedPatientId === p.id && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Create Task</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.gray200 }} />
}

const field = StyleSheet.create({
  wrap: { paddingVertical: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs },
  input: { fontSize: 15, color: colors.gray900, paddingVertical: spacing.xs, minHeight: 32 },
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
    width: 40, height: 40, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { ...typography.h3, color: colors.white },
  body: { padding: spacing.xxl },
  sectionLabel: { ...typography.label, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    paddingHorizontal: spacing.lg, ...shadow.sm,
  },
  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityBtn: {
    flex: 1, borderRadius: radius.full, borderWidth: 1.5,
    borderColor: colors.gray200, paddingVertical: spacing.sm,
    alignItems: 'center', backgroundColor: colors.white,
  },
  priorityBtnText: { fontSize: 11, fontWeight: '700', color: colors.gray500, letterSpacing: 0.3 },
  patientRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
  },
  patientRowContent: { flex: 1 },
  patientMR: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  patientDx: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  noPatients: { ...typography.bodySmall, padding: spacing.lg, textAlign: 'center' },
  selectedPatientMR: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  selectedPatientDx: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.xxl,
    backgroundColor: colors.screenBg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingVertical: 15, alignItems: 'center', ...shadow.md,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
})
