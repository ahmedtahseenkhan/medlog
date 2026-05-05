import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'

export default function ConsultDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Consult Thread</Text>
      <Text style={styles.sub}>ID: {id}</Text>
      <Text style={styles.stub}>
        Full consult thread view will be available once the Consult model is added to the schema.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 60, paddingHorizontal: 24 },
  back: { marginBottom: 16 },
  backText: { fontSize: 15, color: '#1D9E75', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  sub: { fontSize: 13, color: '#6B7280', marginBottom: 24 },
  stub: { fontSize: 14, color: '#9CA3AF', lineHeight: 22, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
})
