// Servicio de notificaciones push via Expo Push API
// No requiere cuenta ni credenciales — Expo maneja APNs y FCM gratis

interface PushMessage {
  to: string | string[]
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
}

export async function sendPushNotification(message: PushMessage): Promise<void> {
  const tokens = Array.isArray(message.to) ? message.to : [message.to]
  const validTokens = tokens.filter(t => t?.startsWith('ExponentPushToken['))
  if (validTokens.length === 0) return

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept':       'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        validTokens.map(token => ({
          to:    token,
          title: message.title,
          body:  message.body,
          data:  message.data ?? {},
          sound: message.sound ?? 'default',
          badge: message.badge,
        }))
      ),
    })
  } catch (err) {
    // No fallar la operación principal si la notif falla
    console.error('Push notification error:', err)
  }
}

export async function getPushToken(db: any, userId: string): Promise<string | null> {
  const result = await db.query('SELECT push_token FROM users WHERE id = $1', [userId])
  return result.rows[0]?.push_token ?? null
}
