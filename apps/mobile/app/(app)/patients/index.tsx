import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, StatusBar, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { database } from '../../../src/db/database'
import type { Patient } from '../../../src/db/models/Patient'
import { colors, typography, spacing, radius, shadow } from '../../../src/theme'
type StatusFilter = 'ALL' | 'ADMITTED' | 'CRITICAL' | 'DISCHARGED'

const FILTERS: StatusFilter[] = ['ALL', 'ADMITTED', 'CRITICAL', 'DISCHARGED']

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  ADMITTED: { bg: colors.successLight, text: '#065F46', border: colors.success, label: 'Admitted' },
  CRITICAL: { bg: colors.dangerLight, text: '#991B1B', border: colors.danger, label: 'Critical' },
  DISCHARGED: { bg: colors.gray100, text: colors.gray500, border: colors.gray300, label: 'Discharged' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: colors.gray100, text: colors.gray500, border: colors.gray300, label: status }
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  )
}

function FollowUpBadge({ followUpDate }: { followUpDate: number | null }) {
  if (!followUpDate) return null
  const date = new Date(followUpDate)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const isOverdue = diffDays < 0
  const isToday = diffDays === 0
  const isSoon = diffDays > 0 && diffDays <= 3

  if (!isOverdue && !isToday && !isSoon) return null

  const label = isOverdue
    ? `Follow-up overdue (${Math.abs(diffDays)}d ago)`
    : isToday
    ? 'Follow-up today'
    : `Follow-up in ${diffDays}d`

  const bg = isOverdue ? colors.dangerLight : isToday ? colors.warningLight : colors.primaryLight
  const textColor = isOverdue ? '#991B1B' : isToday ? '#92400E' : colors.primaryDark

  return (
    <View style={[followUp.wrap, { backgroundColor: bg }]}>
      <Text style={[followUp.text, { color: textColor }]}>⏰ {label}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  wrap: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
})
const followUp = StyleSheet.create({
  wrap: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: spacing.xs },
  text: { fontSize: 11, fontWeight: '600' },
})

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'Just admitted'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('ALL')

  useEffect(() => {
    const subscription = database
      .get<Patient>('patients')
      .query()
      .observe()
      .subscribe((records) => setPatients(records))
    return () => subscription.unsubscribe()
  }, [])

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      p.mrNumber.toLowerCase().includes(q) ||
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.admissionDiagnosis ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    const matchFilter = filter === 'ALL' || p.status === filter
    return matchSearch && matchFilter
  })

  // Sort: CRITICAL first, then by most recent
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'CRITICAL' && b.status !== 'CRITICAL') return -1
    if (b.status === 'CRITICAL' && a.status !== 'CRITICAL') return 1
    return (b.admissionDate ?? 0) - (a.admissionDate ?? 0)
  })

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text style={styles.headerTitle}>Patients</Text>
            {patients.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{patients.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/(app)/patients/new')}
            activeOpacity={0.8}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, MR#, or diagnosis…"
            placeholderTextColor={colors.gray400}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'ALL' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status] ?? { border: colors.gray300, bg: colors.gray100, text: colors.gray500, label: item.status }
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/patients/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={[styles.cardAccent, { backgroundColor: cfg.border }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <View style={{ flex: 1 }}>
                    {item.name ? (
                      <Text style={styles.patientName} numberOfLines={1}>{item.name}</Text>
                    ) : null}
                    <Text style={styles.mrNumber}>MR# {item.mrNumber}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                {item.admissionDiagnosis ? (
                  <Text style={styles.diagnosis} numberOfLines={2}>
                    {item.admissionDiagnosis}
                  </Text>
                ) : null}

                <FollowUpBadge followUpDate={item.followUpDate} />

                <View style={styles.cardFooter}>
                  {item.wardId || item.bedNumber ? (
                    <View style={styles.wardChip}>
                      <Text style={styles.wardChipText}>
                        {[item.wardId ? `Ward ${item.wardId}` : null, item.bedNumber ? `Bed ${item.bedNumber}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                  {item.admissionDate ? (
                    <Text style={styles.timeAgo}>{timeAgo(item.admissionDate)}</Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🩺</Text>
            <Text style={styles.emptyTitle}>
              {search || filter !== 'ALL' ? 'No patients match' : 'No patients yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {search || filter !== 'ALL'
                ? 'Try a different search or filter'
                : 'Tap + Add to register your first patient'}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    backgroundColor: colors.screenBg,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerTitle: { ...typography.h1 },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: 2,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: colors.white },
  addBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.xxl,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    height: 44,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, fontSize: 15, color: colors.gray900 },

  filterScroll: { paddingHorizontal: spacing.xxl, gap: spacing.sm },
  filterChip: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: colors.gray500 },
  filterChipTextActive: { color: colors.white },

  listContent: { paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.lg },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
  patientName: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 2 },
  mrNumber: { fontSize: 13, fontWeight: '500', color: colors.gray500, fontVariant: ['tabular-nums'] },
  diagnosis: { ...typography.body, lineHeight: 20, marginBottom: spacing.xs, fontSize: 14 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  wardChip: {
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  wardChipText: { fontSize: 12, fontWeight: '600', color: colors.gray500 },
  timeAgo: { fontSize: 12, color: colors.gray400 },

  emptyWrap: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.lg, opacity: 0.35 },
  emptyTitle: { ...typography.h4, marginBottom: spacing.sm },
  emptySubtext: { ...typography.bodySmall, textAlign: 'center' },
})
