import { useState, useEffect } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { colors, radius, spacing } from '../../src/theme'
import { database } from '../../src/db/database'
import type { Patient } from '../../src/db/models/Patient'
import type { LabReport } from '../../src/db/models/LabReport'
import type { Task } from '../../src/db/models/Task'
import { Q } from '@nozbe/watermelondb'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeDot} />}
      <Text style={[styles.iconText, focused && styles.iconTextActive]}>{label}</Text>
    </View>
  )
}

function AlertsTabIcon({ focused }: { focused: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    async function countAlerts() {
      try {
        const now = Date.now()
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000

        // Overdue + today follow-ups
        const followUpPatients = await database
          .get<Patient>('patients')
          .query(Q.where('follow_up_date', Q.notEq(null)), Q.where('follow_up_date', Q.lte(now)))
          .fetchCount()

        // Abnormal labs last 7 days
        const abnormalLabs = await database
          .get<LabReport>('lab_reports')
          .query(Q.where('is_abnormal', true), Q.where('reported_at', Q.gte(sevenDaysAgo)))
          .fetchCount()

        // Overdue tasks
        const overdueTasks = await database
          .get<Task>('tasks')
          .query(Q.where('status', Q.notEq('DONE')), Q.where('due_at', Q.notEq(null)), Q.where('due_at', Q.lt(now)))
          .fetchCount()

        setCount(followUpPatients + abnormalLabs + overdueTasks)
      } catch {
        // ignore
      }
    }

    countAlerts()
    const interval = setInterval(countAlerts, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <View style={styles.iconWrap}>
      {focused && <View style={styles.activeDot} />}
      <View>
        <Text style={[styles.iconText, focused && styles.iconTextActive]}>◉</Text>
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Home</Text>,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: 'Patients',
          tabBarIcon: ({ focused }) => <TabIcon label="+" focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Patients</Text>,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused }) => <TabIcon label="✓" focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Tasks</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Profile</Text>,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <AlertsTabIcon focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Alerts</Text>,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ focused }) => <TabIcon label="◷" focused={focused} />,
          tabBarLabel: ({ focused }) => <Text style={[styles.label, focused && styles.labelActive]}>Schedule</Text>,
        }}
      />
      {/*
        notes, consults, pharma, appointments are folder-level tabs.
        Sub-routes live inside their folder's Stack navigator and must NOT
        be declared here to avoid "extraneous screen" warnings.
      */}
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="consults" options={{ href: null }} />
      <Tabs.Screen name="pharma" options={{ href: null }} />
      <Tabs.Screen name="handover" options={{ href: null }} />
      <Tabs.Screen name="calculators" options={{ href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
    height: 64,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 44, height: 28 },
  activeDot: {
    position: 'absolute', top: 0, width: 24, height: 3,
    borderRadius: radius.full, backgroundColor: colors.primary,
  },
  iconText: { fontSize: 22, color: colors.gray400, marginTop: 4, lineHeight: 26 },
  iconTextActive: { color: colors.primary },
  label: { fontSize: 11, fontWeight: '500', color: colors.gray400, marginTop: 2 },
  labelActive: { fontWeight: '700', color: colors.primary },
})
