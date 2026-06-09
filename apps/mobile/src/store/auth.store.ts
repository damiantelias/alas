import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authApi, profileApi } from '../services/api'

interface User {
  id: string
  email: string
  isVerified: boolean
  subscriptionTier: 'free' | 'plus' | 'pro'
}

interface Profile {
  userId: string
  displayName: string
  bio: string | null
  age: number
  genderIdentity: string
  sexualOrientation: string
  lookingFor: string[]
  photos: { url: string; isPrivate: boolean }[]
  city: string
  countryCode: string
  isVerified: boolean
}

interface AuthState {
  user:        User | null
  profile:     Profile | null
  isLoading:   boolean
  isLoggedIn:  boolean

  login:       (email: string, password: string) => Promise<void>
  register:    (email: string, password: string) => Promise<void>
  logout:      () => Promise<void>
  loadSession: () => Promise<void>
  setProfile:  (profile: Profile) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:       null,
  profile:    null,
  isLoading:  false,
  isLoggedIn: false,

  loadSession: async () => {
    set({ isLoading: true })
    try {
      const [accessToken, refreshToken, userStr] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        SecureStore.getItemAsync('refreshToken'),
        SecureStore.getItemAsync('userData'),
      ])
      if (!accessToken || !refreshToken) {
        set({ isLoading: false, isLoggedIn: false })
        return
      }
      const user = userStr ? JSON.parse(userStr) : null
      // Verificar que el token sigue siendo válido
      const { data } = await profileApi.getMe()
      set({ isLoading: false, isLoggedIn: true, user, profile: data.data })
    } catch {
      // Token expirado o inválido → limpiar
      await Promise.all([
        SecureStore.deleteItemAsync('accessToken'),
        SecureStore.deleteItemAsync('refreshToken'),
        SecureStore.deleteItemAsync('userData'),
      ])
      set({ isLoading: false, isLoggedIn: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    await Promise.all([
      SecureStore.setItemAsync('accessToken',  data.data.tokens.accessToken),
      SecureStore.setItemAsync('refreshToken', data.data.tokens.refreshToken),
      SecureStore.setItemAsync('userData',     JSON.stringify(data.data.user)),
    ])
    set({ user: data.data.user, profile: data.data.profile, isLoggedIn: true })
  },

  register: async (email, password) => {
    const { data } = await authApi.register(email, password)
    await Promise.all([
      SecureStore.setItemAsync('accessToken',  data.data.tokens.accessToken),
      SecureStore.setItemAsync('refreshToken', data.data.tokens.refreshToken),
      SecureStore.setItemAsync('userData',     JSON.stringify(data.data.user)),
    ])
    set({ user: data.data.user, profile: null, isLoggedIn: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch {}
    await Promise.all([
      SecureStore.deleteItemAsync('accessToken'),
      SecureStore.deleteItemAsync('refreshToken'),
      SecureStore.deleteItemAsync('userData'),
    ])
    set({ user: null, profile: null, isLoggedIn: false })
  },

  setProfile: (profile) => set({ profile }),
}))
