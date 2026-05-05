import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native'

export interface Conflict {
  id: string
  tableName: string
  localVersion: Record<string, unknown>
  remoteVersion: Record<string, unknown>
}

interface Props {
  conflicts: Conflict[]
  onResolve: (id: string, winner: 'local' | 'remote') => void
  onDismiss: () => void
}

export function SyncConflictModal({ conflicts, onResolve, onDismiss }: Props) {
  const [current, setCurrent] = useState(0)
  const conflict = conflicts[current]

  if (!conflict) return null

  return (
    <Modal transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Sync conflict ({current + 1}/{conflicts.length})</Text>
          <Text style={styles.sub}>Two versions of this {conflict.tableName.replace('_', ' ')} exist. Pick which one to keep.</Text>

          <View style={styles.versions}>
            <VersionCard
              label="Your version (offline)"
              data={conflict.localVersion}
              onSelect={() => {
                onResolve(conflict.id, 'local')
                setCurrent((c) => Math.min(c + 1, conflicts.length - 1))
              }}
              color="#1D9E75"
            />
            <VersionCard
              label="Server version"
              data={conflict.remoteVersion}
              onSelect={() => {
                onResolve(conflict.id, 'remote')
                setCurrent((c) => Math.min(c + 1, conflicts.length - 1))
              }}
              color="#378ADD"
            />
          </View>

          {current >= conflicts.length - 1 && (
            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
              <Text style={styles.dismissText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

function VersionCard({ label, data, onSelect, color }: {
  label: string
  data: Record<string, unknown>
  onSelect: () => void
  color: string
}) {
  const previewKeys = ['content_json', 'title', 'value', 'status']
  const preview = previewKeys
    .map((k) => data[k] ? `${k}: ${String(data[k]).slice(0, 60)}` : null)
    .filter(Boolean)
    .slice(0, 3)

  return (
    <View style={[styles.versionCard, { borderColor: color + '40' }]}>
      <Text style={[styles.versionLabel, { color }]}>{label}</Text>
      <ScrollView style={styles.preview}>
        {preview.length ? preview.map((line, i) => (
          <Text key={i} style={styles.previewLine}>{line}</Text>
        )) : <Text style={styles.previewLine}>No preview available</Text>}
      </ScrollView>
      <TouchableOpacity style={[styles.selectBtn, { backgroundColor: color }]} onPress={onSelect}>
        <Text style={styles.selectText}>Keep this version</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sub: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  versions: { gap: 12 },
  versionCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  versionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  preview: { maxHeight: 80, marginBottom: 10 },
  previewLine: { fontSize: 12, color: '#374151', marginBottom: 2 },
  selectBtn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  selectText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dismissBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  dismissText: { fontSize: 14, color: '#6B7280' },
})
