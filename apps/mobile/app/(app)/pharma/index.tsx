/**
 * Pharma tab — Educational content only — no patient data
 */

import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, SectionList,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import api from '../../../src/lib/api'

interface DrugCard {
  id: string
  name: string
  class: string
  indication: string
  sideEffects: string[]
  interactions: string[]
}

interface DrugAlert {
  id: string
  drug: string
  severity: 'HIGH' | 'MEDIUM'
  message: string
  date: string
}

function SeverityBadge({ severity }: { severity: 'HIGH' | 'MEDIUM' }) {
  const s = severity === 'HIGH'
    ? { bg: '#FEE2E2', color: '#991B1B' }
    : { bg: '#FEF3C7', color: '#92400E' }
  return (
    <View style={[badge.wrap, { backgroundColor: s.bg }]}>
      <Text style={[badge.text, { color: s.color }]}>{severity}</Text>
    </View>
  )
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
})

type Tab = 'DRUGS' | 'ALERTS'

export default function PharmaScreen() {
  const [tab, setTab] = useState<Tab>('DRUGS')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: drugs, isLoading: drugsLoading } = useQuery({
    queryKey: ['pharma', 'drugs'],
    queryFn: async () => {
      const res = await api.get('/pharma/drugs')
      return res.data.data as DrugCard[]
    },
  })

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['pharma', 'alerts'],
    queryFn: async () => {
      const res = await api.get('/pharma/alerts')
      return res.data.data as DrugAlert[]
    },
  })

  const filteredDrugs = (drugs ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.class.toLowerCase().includes(search.toLowerCase())
  )

  const isLoading = tab === 'DRUGS' ? drugsLoading : alertsLoading

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Drug Reference</Text>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>Educational content only — no patient data</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabRow}>
        {(['DRUGS', 'ALERTS'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => { setTab(t); setSearch('') }}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === 'DRUGS' ? 'Drug Reference' : 'Safety Alerts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'DRUGS' && (
        <TextInput
          style={styles.search}
          placeholder="Search drugs…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      )}

      {isLoading ? (
        <ActivityIndicator color="#1D9E75" style={{ marginTop: 40 }} />
      ) : tab === 'DRUGS' ? (
        <FlatList
          data={filteredDrugs}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const expanded = expandedId === item.id
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpandedId(expanded ? null : item.id)}
                activeOpacity={0.85}
              >
                <View style={styles.drugHeader}>
                  <Text style={styles.drugName}>{item.name}</Text>
                  <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
                </View>
                <Text style={styles.drugClass}>{item.class}</Text>
                {expanded && (
                  <View style={styles.drugDetail}>
                    <Text style={styles.detailLabel}>Indication</Text>
                    <Text style={styles.detailText}>{item.indication}</Text>

                    <Text style={styles.detailLabel}>Side effects</Text>
                    {item.sideEffects.map((s, i) => (
                      <Text key={i} style={styles.detailBullet}>• {s}</Text>
                    ))}

                    <Text style={styles.detailLabel}>Interactions</Text>
                    {item.interactions.map((s, i) => (
                      <Text key={i} style={styles.detailBullet}>• {s}</Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={<Text style={styles.empty}>No drugs found</Text>}
        />
      ) : (
        <FlatList
          data={alerts ?? []}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={[styles.card, item.severity === 'HIGH' ? styles.cardHigh : styles.cardMedium]}>
              <View style={styles.alertHeader}>
                <Text style={styles.alertDrug}>{item.drug}</Text>
                <SeverityBadge severity={item.severity} />
              </View>
              <Text style={styles.alertMessage}>{item.message}</Text>
              <Text style={styles.alertDate}>{item.date}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No alerts</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', paddingHorizontal: 24, marginBottom: 10 },

  disclaimer: {
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disclaimerText: { fontSize: 12, color: '#065F46', fontWeight: '600' },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
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

  search: {
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },

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
  cardHigh: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  cardMedium: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },

  drugHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  drugName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  drugClass: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  chevron: { fontSize: 12, color: '#9CA3AF' },

  drugDetail: { marginTop: 10 },
  detailLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginTop: 8, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailText: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
  detailBullet: { fontSize: 13, color: '#4B5563', lineHeight: 22 },

  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertDrug: { fontSize: 15, fontWeight: '700', color: '#111827' },
  alertMessage: { fontSize: 13, color: '#374151', lineHeight: 20, marginBottom: 8 },
  alertDate: { fontSize: 12, color: '#9CA3AF' },

  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 15 },
})
