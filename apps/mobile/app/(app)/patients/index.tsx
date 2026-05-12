import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, StatusBar, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import { colors, spacing, radius, shadow } from '../../../src/theme'

type Filter = 'ALL' | 'ADMITTED' | 'CRITICAL' | 'DISCHARGED'
const FILTERS: Filter[] = ['ALL', 'ADMITTED', 'CRITICAL', 'DISCHARGED']

const STATUS_CFG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  ADMITTED:   { label: 'Admitted',   dot: colors.success,  text: colors.success,  bg: colors.successLight },
  CRITICAL:   { label: 'Critical',   dot: colors.critical, text: colors.critical, bg: colors.criticalBg },
  DISCHARGED: { label: 'Discharged', dot: colors.textSoft,  text: colors.textSoft,  bg: colors.lineLight },
  ARCHIVED:   { label: 'Archived',   dot: colors.textSoft,  text: colors.textSoft,  bg: colors.lineLight },
}

function timeAgo(ts: number | null): string {
  if (!ts) return ''
  const h = Math.floor((Date.now() - ts) / 3_600_000)
  if (h < 1) return '< 1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')

  useEffect(() => {
    const sub = database.get<Patient>('patients').query().observe().subscribe(setPatients)
    return () => sub.unsubscribe()
  }, [])

  const sorted = [...patients].sort((a, b) => {
    if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
    if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1
    return (b.admissionDate ?? 0) - (a.admissionDate ?? 0)
  })

  const filtered = sorted.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || (p.name ?? '').toLowerCase().includes(q)
      || p.mrNumber.toLowerCase().includes(q)
      || (p.admissionDiagnosis ?? '').toLowerCase().includes(q)
    const matchFilter = filter === 'ALL' || p.status === filter
    return matchSearch && matchFilter
  })

  const counts: Record<string, number> = { ALL: patients.length }
  patients.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1 })

  const criticalCount = counts['CRITICAL'] ?? 0

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Teal header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.title}>My Patients</Text>
            <Text style={s.subtitle}>
              {patients.filter(p => p.status !== 'DISCHARGED').length} active
              {criticalCount > 0 ? <Text style={s.criticalNote}>  ·  {criticalCount} critical</Text> : null}
            </Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => router.push('/(app)/patients/new')} activeOpacity={0.85}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Name, MR#, or diagnosis…"
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[s.pill, filter === f && s.pillActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[s.pillText, filter === f && s.pillTextActive]}>
                {f === 'ALL' ? 'All' : STATUS_CFG[f]?.label ?? f}
                {counts[f] != null ? `  ${counts[f]}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item: p }) => {
          const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.ADMITTED
          const isCritical = p.status === 'CRITICAL'

          // Follow-up badge
          let followUp: { text: string; urgent: boolean } | null = null
          if (p.followUpDate) {
            const days = Math.ceil((p.followUpDate - Date.now()) / 86_400_000)
            if (days < 0) followUp = { text: `Follow-up ${Math.abs(days)}d overdue`, urgent: true }
            else if (days === 0) followUp = { text: 'Follow-up today', urgent: true }
            else if (days <= 3) followUp = { text: `Follow-up in ${days}d`, urgent: false }
          }

          return (
            <TouchableOpacity
              style={[s.card, isCritical && s.cardCritical]}
              onPress={() => router.push(`/(app)/patients/${p.id}` as any)}
              activeOpacity={0.8}
            >
              {/* Left accent */}
              <View style={[s.accent, { backgroundColor: cfg.dot }]} />

              <View style={s.cardBody}>
                {/* Top row */}
                <View style={s.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.patientName} numberOfLines={1}>
                      {p.name ?? 'Unknown Patient'}
                    </Text>
                    <Text style={s.patientMR}>
                      MR# {p.mrNumber}
                      {p.wardId ? `  ·  Ward ${p.wardId}` : ''}
                      {p.bedNumber ? `  Bed ${p.bedNumber}` : ''}
                    </Text>
                  </View>

                  {/* Status badge */}
                  <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                    <View style={[s.statusDot, { backgroundColor: cfg.dot }]} />
                    <Text style={[s.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Diagnosis */}
                {p.admissionDiagnosis ? (
                  <Text style={s.diagnosis} numberOfLines={1}>{p.admissionDiagnosis}</Text>
                ) : null}

                {/* Footer */}
                <View style={s.cardFooter}>
                  {followUp ? (
                    <View style={[s.followUpBadge, followUp.urgent && s.followUpBadgeUrgent]}>
                      <Text style={[s.followUpText, followUp.urgent && s.followUpTextUrgent]}>
                        {followUp.text}
                      </Text>
                    </View>
                  ) : <View />}

                  {p.admissionDate ? (
                    <Text style={s.timeAgo}>{timeAgo(p.admissionDate)} ago</Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Text style={{ fontSize: 28 }}>🩺</Text>
            </View>
            <Text style={s.emptyTitle}>
              {search || filter !== 'ALL' ? 'No matches found' : 'No patients yet'}
            </Text>
            <Text style={s.emptyBody}>
              {search ? 'Try a different search' : filter !== 'ALL' ? 'No patients with this status' : 'Tap + Add to register your first patient'}
            </Text>
            {!search && filter === 'ALL' && (
              <TouchableOpacity style={s.emptyAction} onPress={() => router.push('/(app)/patients/new')} activeOpacity={0.85}>
                <Text style={s.emptyActionText}>Add first patient</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    backgroundColor: colors.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  criticalNote: { color: '#FCA5A5', fontWeight: '700' },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: spacing.xxl,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 44,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchIcon: { fontSize: 18, color: 'rgba(255,255,255,0.5)' },
  searchInput: { flex: 1, fontSize: 15, color: colors.white },

  filterRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillActive: { backgroundColor: colors.white, borderColor: colors.white },
  pillText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  pillTextActive: { color: colors.primary, fontWeight: '700' },

  // Cards
  listContent: { padding: spacing.lg, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.md,
  },
  cardCritical: { borderWidth: 1.5, borderColor: colors.criticalBorder },
  accent: { width: 4, borderRadius: 0 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  patientName: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 3, letterSpacing: -0.2 },
  patientMR: { fontSize: 12, color: colors.textSoft, fontVariant: ['tabular-nums'] as any, fontWeight: '500' },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: spacing.xs,
    flexShrink: 0,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  diagnosis: { fontSize: 13, color: colors.textMid, marginBottom: spacing.sm },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  followUpBadge: {
    backgroundColor: colors.lineLight,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  followUpBadgeUrgent: { backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warningBorder },
  followUpText: { fontSize: 11, fontWeight: '600', color: colors.textSoft },
  followUpTextUrgent: { color: colors.warning },
  timeAgo: { fontSize: 12, color: colors.textSoft, fontVariant: ['tabular-nums'] as any },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyBody: { fontSize: 14, color: colors.textSoft, textAlign: 'center', lineHeight: 20 },
  emptyAction: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.xl,
    ...shadow.md,
  },
  emptyActionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
})
