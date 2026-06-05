import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('error', (err) => console.error('❌ Redis error:', err))
redis.on('connect', () => console.log('✅ Redis conectado'))

export const cache = {
  get: async <T>(key: string): Promise<T | null> => {
    const val = await redis.get(key)
    return val ? JSON.parse(val) : null
  },
  set: async (key: string, value: unknown, ttlSeconds?: number): Promise<void> => {
    const s = JSON.stringify(value)
    ttlSeconds ? await redis.setex(key, ttlSeconds, s) : await redis.set(key, s)
  },
  del: async (...keys: string[]): Promise<void> => { await redis.del(...keys) },
  exists: async (key: string): Promise<boolean> => (await redis.exists(key)) === 1,
}

export const TTL = {
  PROFILE: 60 * 5,
  DISCOVER_FEED: 60 * 2,
  USER_SESSION: 60 * 60 * 24,
  RATE_LIMIT: 60 * 60,
}
