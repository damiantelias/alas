import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err)
})

export const db = {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) =>
    pool.query<T>(text, params),
  getClient: () => pool.connect(),
}

export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}
