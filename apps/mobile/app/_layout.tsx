import { useEffect, useState } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { Stack, router } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '../src/stores/auth'
import { colors } from '../src/theme'
import { requestNotificationPermissions } from '../src/services/notifications'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  },
})

function RootLayoutInner() {
  const loadAuth = useAuthStore((s) => s.loadAuth)
  const token = useAuthStore((s) => s.token)
  const isGuest = useAuthStore((s) => s.isGuest)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadAuth().then(() => {
      // Request notification permissions non-blocking — needed for local alerts
      requestNotificationPermissions().catch(() => {})
      setReady(true)
      SplashScreen.hideAsync()
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    if (token || isGuest) {
      router.replace('/(app)/')
    } else {
      router.replace('/(auth)/login')
    }
  }, [ready, token, isGuest])

  if (!ready) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutInner />
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.screenBg,
  },
})
