import axios, { AxiosInstance } from 'axios'
import * as SecureStore from 'expo-secure-store'

const API_URL = 'https://alas-production-d959.up.railway.app'

// Instancia principal de axios
export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor: agrega el token a cada request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Interceptor: si el token expiró (401), intenta renovarlo
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken })
        await SecureStore.setItemAsync('accessToken',  data.data.tokens.accessToken)
        await SecureStore.setItemAsync('refreshToken', data.data.tokens.refreshToken)
        original.headers.Authorization = `Bearer ${data.data.tokens.accessToken}`
        return api(original)
      } catch {
        // Token inválido → cerrar sesión
        await SecureStore.deleteItemAsync('accessToken')
        await SecureStore.deleteItemAsync('refreshToken')
      }
    }
    return Promise.reject(error)
  }
)

// ── Funciones de la API ───────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
}

export const profileApi = {
  getMe: () => api.get('/profiles/me'),
  update: (data: Record<string, unknown>) => api.put('/profiles/me', data),
  getById: (id: string) => api.get(`/profiles/${id}`),
  updatePhotos: (photos: unknown[]) => api.put('/profiles/me/photos', { photos }),
  uploadPhoto: (uri: string, mimeType = 'image/jpeg') => {
    const form = new FormData()
    form.append('photo', { uri, name: 'photo.jpg', type: mimeType } as any)
    return api.post('/upload/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deletePhoto: (url: string) => api.delete('/upload/photo', { data: { url } }),
  toggleIncognito: (enabled: boolean) => api.put('/profiles/me/incognito', { enabled }),
}

export const likesReceivedApi = {
  getReceived: () => api.get('/likes/received'),
}

export const discoverApi = {
  getFeed: (params?: Record<string, unknown>) =>
    api.get('/discover', { params }),
}

export const likesApi = {
  create: (toUserId: string, action: 'like' | 'pass' | 'super') =>
    api.post('/likes', { toUserId, action }),
}

export const matchesApi = {
  getAll: () => api.get('/matches'),
  getMessages: (matchId: string, page = 1) =>
    api.get(`/matches/${matchId}/messages`, { params: { page } }),
  unmatch: (matchId: string) => api.delete(`/matches/${matchId}`),
}

export const reportsApi = {
  create: (reportedUserId: string, reason: string, details?: string) =>
    api.post('/reports', { reportedUserId, reason, details }),
}

export const notificationsApi = {
  registerToken: (token: string) => api.put('/notifications/push-token', { token }),
  deleteToken:   ()              => api.delete('/notifications/push-token'),
  
