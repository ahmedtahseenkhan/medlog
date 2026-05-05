import { synchronize } from '@nozbe/watermelondb/sync'
import NetInfo from '@react-native-community/netinfo'
import { database } from './database'
import { api } from '../lib/api'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

let syncListeners: ((s: SyncStatus) => void)[] = []
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  syncListeners.push(fn)
  return () => { syncListeners = syncListeners.filter((l) => l !== fn) }
}
function emit(s: SyncStatus) { syncListeners.forEach((l) => l(s)) }

/**
 * Pulls changes from the server and pushes local-only records.
 * Safe to call repeatedly — WatermelonDB tracks lastPulledAt internally.
 */
export async function syncDatabase() {
  const net = await NetInfo.fetch()
  if (!net.isConnected) { emit('offline'); return }

  emit('syncing')
  try {
    await synchronize({
      database,

      pullChanges: async ({ lastPulledAt }) => {
        const { data } = await api.get<{
          changes: Record<string, { created: object[]; updated: object[]; deleted: string[] }>
          timestamp: number
        }>('/sync/pull', { params: { lastPulledAt } })
        return { changes: data.changes, timestamp: data.timestamp }
      },

      pushChanges: async ({ changes, lastPulledAt }) => {
        await api.post('/sync/push', { changes, lastPulledAt })
      },

      migrationsEnabledAtVersion: 1,

      conflictResolver: (tableName, local, remote) => {
        // Last-write-wins by updatedAt, but flag for user review on clinical notes
        if (tableName === 'clinical_notes') {
          const localUpdated = (local as { updated_at: number }).updated_at
          const remoteUpdated = (remote as { updated_at: number }).updated_at
          if (localUpdated > remoteUpdated) {
            return { ...remote, ...local, _conflict: 'local_wins' }
          }
          return { ...local, ...remote, _conflict: 'remote_wins' }
        }
        return { ...local, ...remote }
      },
    })
    emit('idle')
  } catch (err) {
    console.error('Sync failed:', err)
    emit('error')
  }
}
