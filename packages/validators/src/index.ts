import { z } from 'zod'

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
})

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

// ─── Perfil ────────────────────────────────────────────────────────────────────

const LOOKING_FOR_VALUES = ['dates', 'friendship', 'relationship', 'casual', 'networking'] as const

export const CreateProfileSchema = z.object({
  displayName:       z.string().min(2).max(30),
  bio:               z.string().max(300).optional(),
  birthdate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  genderIdentity:    z.string().min(1).max(60),
  sexualOrientation: z.string().min(1).max(60),
  lookingFor:        z.array(z.enum(LOOKING_FOR_VALUES)).min(1),
  city:              z.string().min(2).max(80),
  countryCode:       z.string().length(2),
  latitude:          z.number().min(-90).max(90),
  longitude:         z.number().min(-180).max(180),
})

export const UpdateProfileSchema = CreateProfileSchema.partial()

// ─── Discover ──────────────────────────────────────────────────────────────────

export const DiscoverQuerySchema = z.object({
  radiusKm:          z.coerce.number().min(1).max(100).default(25),
  genderIdentity:    z.string().optional(),
  sexualOrientation: z.string().optional(),
  minAge:            z.coerce.number().min(18).max(99).default(18),
  maxAge:            z.coerce.number().min(18).max(99).default(99),
  lookingFor:        z.string().optional(),
  page:              z.coerce.number().min(1).default(1),
})

// ─── Likes ─────────────────────────────────────────────────────────────────────

export const LikeSchema = z.object({
  toUserId: z.string().uuid(),
  action:   z.enum(['like', 'pass', 'super']),
})

// ─── Mensajes ──────────────────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  type:    z.enum(['text', 'image', 'emoji']).default('text'),
})

// ─── Reporte ───────────────────────────────────────────────────────────────────

export const ReportSchema = z.object({
  reportedUserId: z.string().uuid(),
  reason:         z.enum(['fake', 'harassment', 'spam', 'inappropriate', 'other']),
  details:        z.string().max(500).optional(),
})

export type RegisterInput       = z.infer<typeof RegisterSchema>
export type LoginInput          = z.infer<typeof LoginSchema>
export type CreateProfileInput  = z.infer<typeof CreateProfileSchema>
export type UpdateProfileInput  = z.infer<typeof UpdateProfileSchema>
export type DiscoverQuery       = z.infer<typeof DiscoverQuerySchema>
export type LikeInput           = z.infer<typeof LikeSchema>
export type SendMessageInput    = z.infer<typeof SendMessageSchema>
export type ReportInput         = z.infer<typeof ReportSchema>
