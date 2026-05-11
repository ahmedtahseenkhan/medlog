import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Share, Alert, ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import type { Task } from '../../../src/db/models/Task'
import type { LabReport } from '../../../src/db/models/LabReport'
import type { Vitals } from '../../../src/db/models/Vitals'
import { Q } from '@nozbe/watermelondb'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

interface CaseData {
  patient: Patient
  tasks: Task[]
  labs: LabReport[]
  vitals: Vitals[]
}

async function buildCase(patientId: string): Promise<CaseData | null> {
  const patient = await database.get<Patient>('patients').find(patientId).catch(() => null)
  if (!patient) return null
  const tasks = await database.get<Task>('tasks').query(Q.where('patient_id', patientId)).fetch()
  const labs = await database.get<LabReport>('lab_reports').query(Q.where('patient_id', patientId)).fetch()
  const vitals = await database.get<Vitals>('vitals').query(Q.where('patient_id', patientId)).fetch()
  return { patient, tasks, labs, vitals }
}

function buildLogbookText(d: CaseData): string {
  const p = d.patient
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtTime = (ts: number) => new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const lines: string[] = [
    '╔══════════════════════════════════════════╗',
    '║        CLINICAL CASE LOG                ║',
    '║        MedLog AI — Doctor Portfolio     ║',
    '╚══════════════════════════════════════════╝',
    '',
    `Generated: ${now}`,
    '',
    '━━━ PATIENT DETAILS ━━━━━━━━━━━━━━━━━━━━━━',
    `Name:        ${p.name ?? 'Anonymous'}`,
    `MR Number:   ${p.mrNumber}`,
    `Status:      ${p.status}`,
    p.wardId ? `Ward / Bed:  Ward ${p.wardId}${p.bedNumber ? `, Bed ${p.bedNumber}` : ''}` : '',
    p.admissionDate ? `Admitted:    ${fmtDate(p.admissionDate)}` : '',
    p.admissionDiagnosis ? `Diagnosis:   ${p.admissionDiagnosis}` : '',
    p.followUpDate ? `Follow-up:   ${fmtDate(p.followUpDate)}${p.followUpNotes ? ` (${p.followUpNotes})` : ''}` : '',
    '',
  ].filter(l => l !== undefined)

  // Labs
  if (d.labs.length > 0) {
    lines.push('━━━ INVESTIGATION RESULTS ━━━━━━━━━━━━━━━━')
    const sorted = [...d.labs].sort((a, b) => a.reportedAt - b.reportedAt)
    sorted.forEach(l => {
      const flag = l.isCritical ? ' [⚠️ CRITICAL]' : l.isAbnormal ? ' [ABNORMAL]' : ''
      const range = l.referenceRangeLow != null && l.referenceRangeHigh != null
        ? ` (ref: ${l.referenceRangeLow}–${l.referenceRangeHigh} ${l.unit})`
        : ''
      lines.push(`${fmtTime(l.reportedAt)}  ${l.testName}: ${l.value} ${l.unit}${range}${flag}`)
    })
    lines.push('')
  }

  // Vitals
  if (d.vitals.length > 0) {
    lines.push('━━━ VITAL SIGNS ━━━━━━━━━━━━━━━━━━━━━━━━━━')
    const sorted = [...d.vitals].sort((a, b) => a.recordedAt - b.recordedAt)
    sorted.forEach(v => {
      const parts: string[] = []
      if (v.bpSystolic && v.bpDiastolic) parts.push(`BP ${v.bpSystolic}/${v.bpDiastolic}`)
      if (v.heartRate) parts.push(`HR ${v.heartRate}`)
      if (v.temperature) parts.push(`T ${v.temperature}°C`)
      if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`)
      if (v.respiratoryRate) parts.push(`RR ${v.respiratoryRate}`)
      lines.push(`${fmtTime(v.recordedAt)}  ${parts.join(' | ')}`)
      if (v.notes) lines.push(`  Notes: ${v.notes}`)
    })
    lines.push('')
  }

  // Tasks / clinical actions
  if (d.tasks.length > 0) {
    lines.push('━━━ CLINICAL ACTIONS ━━━━━━━━━━━━━━━━━━━━━')
    const done = d.tasks.filter(t => t.status === 'DONE')
    const pending = d.tasks.filter(t => t.status !== 'DONE')
    if (done.length > 0) {
      lines.push('Completed:')
      done.forEach(t => lines.push(`  ✓ [${t.priority}] ${t.title}`))
    }
    if (pending.length > 0) {
      lines.push('Pending:')
      pending.forEach(t => {
        const due = t.dueAt ? ` — due ${fmtTime(t.dueAt)}` : ''
        lines.push(`  ○ [${t.priority}] ${t.title}${due}`)
      })
    }
    lines.push('')
  }

  // Summary for logbook
  lines.push('━━━ CASE SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`Total investigations: ${d.labs.length}`)
  lines.push(`  — Abnormal: ${d.labs.filter(l => l.isAbnormal).length}`)
  lines.push(`  — Critical: ${d.labs.filter(l => l.isCritical).length}`)
  lines.push(`Vital signs recorded: ${d.vitals.length}`)
  lines.push(`Clinical tasks: ${d.tasks.length} (${d.tasks.filter(t => t.status === 'DONE').length} completed)`)
  lines.push('')
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('Generated by MedLog AI — For personal case logbook use only')
  lines.push('This record is for clinical portfolio purposes only.')

  return lines.join('\n')
}

export default function LogbookScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>()
  const [data, setData] = useState<CaseData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buildCase(patientId).then(d => { setData(d); setLoading(false) })
  }, [patientId])

  async function handleExport() {
    if (!data) return
    const text = buildLogbookText(data)
    try {
      await Share.share({
        message: text,
        title: `Case Log — ${data.patient.name ?? `MR# ${data.patient.mrNumber}`}`,
      })
    } catch {
      Alert.alert('Error', 'Could not share case log')
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.screenBg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    )
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.screenBg }}>
        <Text style={{ color: colors.gray500 }}>Patient not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const p = data.patient
  const abnormalLabs = data.labs.filter(l => l.isAbnormal)
  const completedTasks = data.tasks.filter(t => t.status === 'DONE')

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{'<'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Case Logbook</Text>
          <Text style={styles.headerSub}>{p.name ?? `MR# ${p.mrNumber}`}</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport} activeOpacity={0.85}>
          <Text style={styles.exportIcon}>⬆</Text>
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Patient card */}
        <View style={styles.patientCard}>
          <View style={styles.patientCardHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(p.name ?? p.mrNumber)[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{p.name ?? `MR# ${p.mrNumber}`}</Text>
              {p.name && <Text style={styles.patientMR}>MR# {p.mrNumber}</Text>}
              <View style={[styles.statusBadge, { backgroundColor: p.status === 'CRITICAL' ? colors.dangerLight : colors.successLight }]}>
                <Text style={[styles.statusText, { color: p.status === 'CRITICAL' ? colors.danger : colors.success }]}>{p.status}</Text>
              </View>
            </View>
          </View>

          {p.admissionDiagnosis ? (
            <View style={styles.dxRow}>
              <Text style={styles.dxLabel}>DIAGNOSIS</Text>
              <Text style={styles.dxValue}>{p.admissionDiagnosis}</Text>
            </View>
          ) : null}

          <View style={styles.detailsGrid}>
            {p.wardId ? <DetailChip label="Ward" value={p.wardId} /> : null}
            {p.bedNumber ? <DetailChip label="Bed" value={p.bedNumber} /> : null}
            {p.admissionDate ? <DetailChip label="Admitted" value={new Date(p.admissionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} /> : null}
            {p.followUpDate ? <DetailChip label="Follow-up" value={new Date(p.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} /> : null}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox value={data.labs.length} label="Total Labs" icon="🧪" color={colors.primary} />
          <StatBox value={abnormalLabs.length} label="Abnormal" icon="⚠️" color={colors.warning} />
          <StatBox value={data.vitals.length} label="Vitals Taken" icon="💓" color={colors.success} />
          <StatBox value={completedTasks.length} label="Tasks Done" icon="✓" color="#7C3AED" />
        </View>

        {/* Labs timeline */}
        {data.labs.length > 0 && (
          <Section title="🧪 Lab Results" count={data.labs.length}>
            {[...data.labs].sort((a, b) => a.reportedAt - b.reportedAt).map(lab => (
              <View key={lab.id} style={[styles.logItem, (lab.isCritical || lab.isAbnormal) && styles.logItemAbnormal]}>
                <Text style={styles.logTime}>{new Date(lab.reportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>{lab.testName}</Text>
                  <Text style={[styles.logValue, lab.isCritical ? { color: colors.danger } : lab.isAbnormal ? { color: colors.warning } : {}]}>
                    {lab.value} {lab.unit}
                    {lab.isCritical ? ' ⚠️ CRITICAL' : lab.isAbnormal ? ' ↑ ABNORMAL' : ''}
                  </Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Vitals timeline */}
        {data.vitals.length > 0 && (
          <Section title="💓 Vital Signs" count={data.vitals.length}>
            {[...data.vitals].sort((a, b) => a.recordedAt - b.recordedAt).map(v => {
              const parts = [
                v.bpSystolic && v.bpDiastolic ? `BP ${v.bpSystolic}/${v.bpDiastolic}` : null,
                v.heartRate ? `HR ${v.heartRate}` : null,
                v.temperature ? `T ${v.temperature}°C` : null,
                v.spo2 ? `SpO₂ ${v.spo2}%` : null,
                v.respiratoryRate ? `RR ${v.respiratoryRate}` : null,
              ].filter(Boolean)
              return (
                <View key={v.id} style={styles.logItem}>
                  <Text style={styles.logTime}>{new Date(v.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logValue}>{parts.join(' · ')}</Text>
                    {v.notes ? <Text style={styles.logNotes}>{v.notes}</Text> : null}
                  </View>
                </View>
              )
            })}
          </Section>
        )}

        {/* Tasks */}
        {data.tasks.length > 0 && (
          <Section title="✓ Clinical Actions" count={data.tasks.length}>
            {data.tasks.map(t => (
              <View key={t.id} style={styles.logItem}>
                <Text style={[styles.logTime, { color: t.status === 'DONE' ? colors.success : colors.gray400 }]}>
                  {t.status === 'DONE' ? '✓' : '○'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logTitle, t.status === 'DONE' && { textDecorationLine: 'line-through', color: colors.gray400 }]}>{t.title}</Text>
                  <Text style={styles.logNotes}>{t.priority} priority{t.dueAt ? ` · ${new Date(t.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

        {/* Export button */}
        <TouchableOpacity style={styles.exportBottomBtn} onPress={handleExport} activeOpacity={0.85}>
          <Text style={styles.exportBottomIcon}>⬆</Text>
          <Text style={styles.exportBottomText}>Export Case Log (Share / Copy)</Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>This case log is for personal clinical portfolio and logbook purposes only. Patient information must be handled in accordance with local data protection regulations.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{count}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function StatBox({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
  return (
    <View style={[sb.box, value > 0 && { borderColor: color, borderWidth: 1.5 }]}>
      <Text style={sb.icon}>{icon}</Text>
      <Text style={[sb.value, { color: value > 0 ? color : colors.gray300 }]}>{value}</Text>
      <Text style={sb.label}>{label}</Text>
    </View>
  )
}
const sb = StyleSheet.create({
  box: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: colors.gray200, marginHorizontal: 2 },
  icon: { fontSize: 16, marginBottom: 2 },
  value: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 10, color: colors.gray400, fontWeight: '600', textAlign: 'center', marginTop: 1 },
})

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={dc.chip}>
      <Text style={dc.label}>{label}</Text>
      <Text style={dc.value}>{value}</Text>
    </View>
  )
}
const dc = StyleSheet.create({
  chip: { backgroundColor: colors.gray50, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.gray200 },
  label: { fontSize: 9, fontWeight: '800', color: colors.gray400, letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { fontSize: 13, fontWeight: '700', color: colors.gray900 },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screenBg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: spacing.lg, paddingHorizontal: spacing.xl,
  },
  backBtn: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 20, color: colors.white, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  exportBtn: { flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  exportIcon: { fontSize: 16, color: colors.white },
  exportText: { fontSize: 11, fontWeight: '800', color: colors.white },

  body: { padding: spacing.lg, paddingBottom: 40 },

  patientCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  patientCardHeader: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.white },
  patientName: { fontSize: 16, fontWeight: '800', color: colors.gray900 },
  patientMR: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  statusBadge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '800' },
  dxRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray100, paddingTop: spacing.md, marginBottom: spacing.md },
  dxLabel: { fontSize: 10, fontWeight: '800', color: colors.gray400, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  dxValue: { fontSize: 14, color: colors.gray700, fontStyle: 'italic' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  statsRow: { flexDirection: 'row', gap: 4, marginBottom: spacing.md },

  section: { backgroundColor: colors.white, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden', ...shadow.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.gray50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray200 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.gray900 },
  sectionCount: { fontSize: 13, fontWeight: '700', color: colors.gray500, backgroundColor: colors.gray200, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  sectionBody: { padding: spacing.md },

  logItem: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.gray100 },
  logItemAbnormal: { backgroundColor: colors.warningLight + '40' },
  logTime: { fontSize: 12, color: colors.gray400, width: 48, fontWeight: '600', marginTop: 2 },
  logTitle: { fontSize: 14, fontWeight: '600', color: colors.gray900, marginBottom: 2 },
  logValue: { fontSize: 13, color: colors.gray700, fontWeight: '500' },
  logNotes: { fontSize: 12, color: colors.gray400, fontStyle: 'italic', marginTop: 2 },

  exportBottomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, marginBottom: spacing.md, ...shadow.md },
  exportBottomIcon: { fontSize: 18, color: colors.white },
  exportBottomText: { fontSize: 15, fontWeight: '700', color: colors.white },

  disclaimer: { backgroundColor: colors.gray100, borderRadius: radius.lg, padding: spacing.lg },
  disclaimerText: { fontSize: 11, color: colors.gray500, lineHeight: 16, textAlign: 'center' },
})
