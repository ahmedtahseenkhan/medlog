import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { User } from '../../src/types'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: User | null
  isGuest: boolean
  setAuth: (token: string, refreshToken: string, user: User) => Promise<void>
  loadAuth: () => Promise<void>
  clearAuth: () => Promise<void>
  loginAsGuest: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isGuest: false,

  setAuth: async (token, refreshToken, user) => {
    await SecureStore.setItemAsync('accessToken', token)
    await SecureStore.setItemAsync('refreshToken', refreshToken)
    await SecureStore.setItemAsync('user', JSON.stringify(user))
    await SecureStore.deleteItemAsync('guestMode')
    set({ token, refreshToken, user, isGuest: false })
  },

  loadAuth: async () => {
    const guestMode = await SecureStore.getItemAsync('guestMode')
    if (guestMode === 'true') {
      set({ isGuest: true })
      return
    }
    const token = await SecureStore.getItemAsync('accessToken')
    const refreshToken = await SecureStore.getItemAsync('refreshToken')
    const userRaw = await SecureStore.getItemAsync('user')
    if (token && userRaw) {
      set({ token, refreshToken, user: JSON.parse(userRaw) })
    }
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('user')
    await SecureStore.deleteItemAsync('guestMode')
    set({ token: null, refreshToken: null, user: null, isGuest: false })
  },

  loginAsGuest: async () => {
    await SecureStore.setItemAsync('guestMode', 'true')
    set({ isGuest: true, token: null, user: null })
  },
}))
