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
  set({ isLoading: false, isLoggedIn: false })
},

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    await SecureStore.setItemAsync('accessToken',  data.data.tokens.accessToken)
    await SecureStore.setItemAsync('refreshToken', data.data.tokens.refreshToken)
    set({ user: data.data.user, profile: data.data.profile, isLoggedIn: true })
  },

  register: async (email, password) => {
    const { data } = await authApi.register(email, password)
    await SecureStore.setItemAsync('accessToken',  data.data.tokens.accessToken)
    await SecureStore.setItemAsync('refreshToken', data.data.tokens.refreshToken)
    set({ user: data.data.user, profile: null, isLoggedIn: true })
  },

  logout: async () => {
    try { await authApi.logout() } catch {}
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    set({ user: null, profile: null, isLoggedIn: false })
  },

  setProfile: (profile) => set({ profile }),
}))
