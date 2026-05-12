import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, StatusBar, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'

type Filter = 'ALL' | 'ADMITTED' | 'CRITICAL' | 'DISCHARGED'
const FILTERS: Filter[] = ['ALL', 'ADMITTED', 'CRITICAL', 'DISCHARGED']

const STATUS_LABEL: Record<string, string> = {
  ADMITTED: 'Admitted', CRITICAL: 'Critical', DISCHARGED: 'Discharged', ARCHIVED: 'Archived',
}
const STATUS_COLOR: Record<string, string> = {
  CRITICAL: colors.critical, ADMITTED: colors.stable, DISCHARGED: colors.textSoft, ARCHIVED: colors.textSoft,
}

function timeAgo(ts: number | null): string {
  if (!ts) return ''
  const h = Math.floor((Date.now() - ts) / 3_600_000)
  if (h < 1) return '< 1h'
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function followUpBadge(followUpDate: number | null): { label: string; urgent: boolean } | null {
  if (!followUpDate) return null
  const days = Math.ceil((followUpDate - Date.now()) / 86_400_000)
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, urgent: true }
  if (days === 0) return { label: 'Follow-up today', urgent: true }
  if (days <= 3) return { label: `Follow-up in ${days}d`, urgent: false }
  return null
}

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')

  useEffect(() => {
    const sub = database.get<Patient>('patients').query().observe().subscribe(setPatients)
    return () => sub.unsubscribe()
  }, [])

  const filtered = patients
    .filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || (p.name ?? '').toLowerCase().includes(q)
        || p.mrNumber.toLowerCase().includes(q)
        || (p.admissionDiagnosis ?? '').toLowerCase().includes(q)
        || (p.phone ?? '').includes(q)
      const matchFilter = filter === 'ALL' || p.status === filter
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
      if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1
      return (b.admissionDate ?? 0) - (a.admissionDate ?? 0)
    })

  const counts: Record<string, number> = { ALL: patients.length }
  patients.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1 })

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Patients</Text>
            <Text style={styles.headerSub}>
              {patients.filter(p => p.status !== 'DISCHARGED').length} active
              {counts['CRITICAL'] ? ` · ${counts['CRITICAL']} critical` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(app)/patients/new')}
            activeOpacity={0.85}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Text style={styles.searchGlass}>⌕</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Name, MR number, diagnosis…"
              placeholderTextColor={colors.textSoft}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
                {counts[f] ? ` ${counts[f]}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Patient list ── */}
      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={filtered.length > 0 ? <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>PATIENT</Text>
          <Text style={styles.listHeaderText}>STATUS</Text>
        </View> : null}
        renderItem={({ item: p }) => {
          const isCritical = p.status === 'CRITICAL'
          const followUp = followUpBadge(p.followUpDate)
          const statusColor = STATUS_COLOR[p.status] ?? colors.textSoft

          return (
            <TouchableOpacity
              style={[styles.row, isCritical && styles.rowCritical]}
              onPress={() => router.push(`/(app)/patients/${p.id}` as any)}
              activeOpacity={0.7}
            >
              {/* Critical indicator stripe */}
              <View style={[styles.stripe, { backgroundColor: isCritical ? colors.critical : p.status === 'ADMITTED' ? colors.stable : 'transparent' }]} />

              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  {/* Name + MR */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.patientName, isCritical && { color: colors.critical }]} numberOfLines={1}>
                      {p.name ?? `Patient`}
                    </Text>
                    <Text style={styles.patientMR}>
                      MR# {p.mrNumber}
                      {p.wardId ? `  ·  Ward ${p.wardId}` : ''}
                      {p.bedNumber ? `  Bed ${p.bedNumber}` : ''}
                    </Text>
                  </View>

                  {/* Status + time */}
                  <View style={styles.rowRight}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {isCritical ? '⚑ ' : ''}{STATUS_LABEL[p.status] ?? p.status}
                    </Text>
                    {p.admissionDate ? (
                      <Text style={styles.timeAgo}>{timeAgo(p.admissionDate)}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Diagnosis */}
                {p.admissionDiagnosis ? (
                  <Text style={styles.diagnosis} numberOfLines={1}>{p.admissionDiagnosis}</Text>
                ) : null}

                {/* Follow-up badge */}
                {followUp && (
                  <View style={[styles.followUpChip, followUp.urgent && styles.followUpChipUrgent]}>
                    <Text style={[styles.followUpText, followUp.urgent && styles.followUpTextUrgent]}>
                      {followUp.label}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {search || filter !== 'ALL' ? 'No matches' : 'No patients'}
            </Text>
            <Text style={styles.emptyBody}>
              {search ? 'Try a different search term' : filter !== 'ALL' ? 'No patients with this status' : 'Tap + Add to register your first patient'}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ── Header ──
  header: {
    backgroundColor: colors.ink,
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
  headerTitle: { fontSize: 26, fontWeight: '700', color: colors.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontVariant: ['tabular-nums'] as any },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: 4,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  searchRow: { paddingHorizontal: spacing.xxl, marginBottom: spacing.md },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchGlass: { fontSize: 18, color: 'rgba(255,255,255,0.4)', marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 14, color: colors.white },

  filterRow: { paddingHorizontal: spacing.xl, gap: spacing.xs, paddingBottom: spacing.sm },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterTabActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.4)' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.2 },
  filterTabTextActive: { color: colors.white },

  // ── List ──
  list: { paddingBottom: 40 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  listHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSoft,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: spacing.xxl + 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
  },
  rowCritical: { backgroundColor: '#FFFAFA' },
  stripe: { width: 3, alignSelf: 'stretch', marginRight: spacing.md, marginLeft: spacing.xl },

  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  patientName: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  patientMR: {
    fontSize: 12,
    color: colors.textSoft,
    fontVariant: ['tabular-nums'] as any,
    marginTop: 2,
    fontWeight: '500',
  },
  diagnosis: { fontSize: 13, color: colors.textMid, marginTop: 2, fontStyle: 'italic' },

  rowRight: { alignItems: 'flex-end', marginLeft: spacing.md, flexShrink: 0 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  timeAgo: {
    fontSize: 11,
    color: colors.textSoft,
    fontVariant: ['tabular-nums'] as any,
    marginTop: 2,
  },

  followUpChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lineLight,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  followUpChipUrgent: { backgroundColor: colors.abnormalBg, borderWidth: 1, borderColor: colors.abnormalBorder },
  followUpText: { fontSize: 11, fontWeight: '600', color: colors.textSoft },
  followUpTextUrgent: { color: colors.abnormal },

  rowChevron: { fontSize: 20, color: colors.line, marginLeft: spacing.sm },

  // ── Empty ──
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xxxl },
  emptyTitle: { ...typography.h4, color: colors.textMid, marginBottom: spacing.sm },
  emptyBody: { ...typography.bodySmall, textAlign: 'center', lineHeight: 20 },
})
