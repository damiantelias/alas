// ─── Enums ────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'plus' | 'pro'
export type MatchStatus      = 'active' | 'unmatched'
export type MessageType      = 'text' | 'image' | 'emoji'
export type ReportReason     = 'fake' | 'harassment' | 'spam' | 'inappropriate' | 'other'
export type ReportStatus     = 'pending' | 'resolved'
export type LikeAction       = 'like' | 'pass' | 'super'
export type CommunityType    = 'city' | 'identity' | 'interest'
export type PaymentProvider  = 'mercadopago' | 'stripe'
export type SubStatus        = 'active' | 'cancelled' | 'expired'
export type LookingFor       = 'dates' | 'friendship' | 'relationship' | 'casual' | 'networking'

// ─── Entidades principales ────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  isVerified: boolean
  isActive: boolean
  subscriptionTier: SubscriptionTier
  createdAt: string
  lastSeenAt: string
}

export interface Profile {
  id: string
  userId: string
  displayName: string
  bio: string | null
  birthdate: string
  age: number
  genderIdentity: string
  sexualOrientation: string
  lookingFor: LookingFor[]
  city: string
  countryCode: string
  photos: ProfilePhoto[]
  isIncognito: boolean
  isVerified: boolean
  distanceKm?: number
}

export interface ProfilePhoto {
  url: string
  isPrivate: boolean
  order: number
}

export interface Match {
  id: string
  userAId: string
  userBId: string
  status: MatchStatus
  matchedAt: string
  lastMessageAt: string | null
  otherProfile?: Profile
  lastMessage?: Message
  unreadCount?: number
}

export interface Message {
  id: string
  matchId: string
  senderId: string
  content: string
  type: MessageType
  readAt: string | null
  createdAt: string
}

export interface Community {
  id: string
  name: string
  slug: string
  type: CommunityType
  countryCode: string
  memberCount: number
  isJoined?: boolean
}

// ─── Respuestas de la API ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthResponse {
  user: User
  profile: Profile | null
  tokens: AuthTokens
}

// ─── Eventos Socket.io ─────────────────────────────────────────────────────────

export interface SocketEvents {
  // Cliente → Servidor
  'chat:join':    (matchId: string) => void
  'chat:message': (payload: { matchId: string; content: string; type: MessageType }) => void
  'chat:typing':  (matchId: string) => void
  'chat:read':    (matchId: string) => void

  // Servidor → Cliente
  'chat:new_message':  (message: Message) => void
  'chat:typing_start': (payload: { matchId: string; userId: string }) => void
  'chat:typing_stop':  (payload: { matchId: string; userId: string }) => void
  'match:new':         (match: Match) => void
  'notification:new':  (notification: AppNotification) => void
}

export interface AppNotification {
  id: string
  type: 'new_match' | 'new_message' | 'new_like' | 'system'
  title: string
  body: string
  data?: Record<string, unknown>
  createdAt: string
  readAt: string | null
}
