import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
          await useAuthStore.getState().setAuth(data.accessToken, refreshToken, useAuthStore.getState().user!)
          original.headers.Authorization = `Bearer ${data.accessToken}`
          return api(original)
        } catch {
          await useAuthStore.getState().clearAuth()
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
