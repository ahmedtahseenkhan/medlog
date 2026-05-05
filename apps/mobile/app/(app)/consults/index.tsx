import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import api from '../../../src/lib/api'

type Urgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY'
type ConsultStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'COMPLETED'

interface Consult {
  id: string
  patientMrNumber: string
  fromUserName: string
  toUserName: string
  urgency: Urgency
  status: ConsultStatus
  createdAt: string
}

type Tab = 'INCOMING' | 'OUTGOING'

const URGENCY_COLORS: Record<Urgency, { bg: string; color: string }> = {
  EMERGENCY: { bg: '#FEE2E2', color: '#991B1B' },
  URGENT:    { bg: '#FEF3C7', color: '#92400E' },
  ROUTINE:   { bg: '#F3F4F6', color: '#6B7280' },
}

const STATUS_COLORS: Record<ConsultStatus, { bg: string; color: string }> = {
  PENDING:   { bg: '#EFF6FF', color: '#1D4ED8' },
  ACCEPTED:  { bg: '#D1FAE5', color: '#065F46' },
  DECLINED:  { bg: '#FEE2E2', color: '#991B1B' },
  COMPLETED: { bg: '#F3F4F6', color: '#6B7280' },
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const s = URGENCY_COLORS[urgency] ?? URGENCY_COLORS.ROUTINE
  return (
    <View style={[badge.wrap, { backgroundColor: s.bg }]}>
      <Text style={[badge.text, { color: s.color }]}>{urgency}</Text>
    </View>
  )
}

function StatusBadge({ status }: { status: ConsultStatus }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.PENDING
  return (
    <View style={[badge.wrap, { backgroundColor: s.bg }]}>
      <Text style={[badge.text, { color: s.color }]}>{status}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
})

export default function ConsultsScreen() {
  const [tab, setTab] = useState<Tab>('INCOMING')

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['consults'],
    queryFn: async () => {
      try {
        const res = await api.get('/consults')
        return res.data.data as Consult[]
      } catch {
        // API returns 501 until Consult model is added — return empty list
        return [] as Consult[]
      }
    },
    retry: false,
  })

  const consults = data ?? []

  // Once the real API is live, the server will scope by direction.
  // For now all consults show under both tabs as a fallback.
  const displayed = consults

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Consults</Text>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['INCOMING', 'OUTGOING'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'INCOMING' ? 'Incoming' : 'Outgoing'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#1D9E75" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#1D9E75" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/consults/${item.id}` as never)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.mrNumber}>MR# {item.patientMrNumber}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.doctor}>
                {item.fromUserName} → {item.toUserName}
              </Text>
              <View style={styles.badges}>
                <UrgencyBadge urgency={item.urgency} />
                <View style={{ width: 8 }} />
                <StatusBadge status={item.status} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No {tab === 'INCOMING' ? 'incoming' : 'outgoing'} consults</Text>
              <Text style={styles.emptySubtext}>Consult model pending schema migration</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', paddingHorizontal: 24, marginBottom: 16 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  tabLabelActive: { color: '#111827', fontWeight: '700' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  mrNumber: { fontSize: 15, fontWeight: '700', color: '#111827' },
  date: { fontSize: 12, color: '#9CA3AF' },
  doctor: { fontSize: 13, color: '#374151', marginBottom: 10 },
  badges: { flexDirection: 'row', alignItems: 'center' },

  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  emptySubtext: { fontSize: 12, color: '#D1D5DB', marginTop: 4 },
})
