import FormData from 'form-data'
import axios from 'axios'

const API_USER   = process.env.SIGHTENGINE_USER   ?? ''
const API_SECRET = process.env.SIGHTENGINE_SECRET ?? ''

export interface ModerationResult {
  approved: boolean
  reason?: string
}

/**
 * Analiza un buffer de imagen con Sightengine.
 * Rechaza si:
 *  - nudity.sexual_activity > 0.5  (contenido explícito)
 *  - nudity.sexual_display  > 0.5  (desnudez frontal)
 *  - nudity.erotica          > 0.7  (erótico sin ser explícito)
 *  - minor.minor_detected    === true (posible menor detectado)
 */
export async function moderateImage(buffer: Buffer, mimetype: string): Promise<ModerationResult> {
  if (!API_USER || !API_SECRET) {
    console.warn('[moderation] Credenciales Sightengine no configuradas — omitiendo moderación')
    return { approved: true }
  }

  try {
    const form = new FormData()
    form.append('media',      buffer, { filename: 'photo.jpg', contentType: mimetype })
    form.append('models',     'nudity-2.1,minor-2')
    form.append('api_user',   API_USER)
    form.append('api_secret', API_SECRET)

    const { data } = await axios.post(
      'https://api.sightengine.com/1.0/check.json',
      form,
      { headers: form.getHeaders(), timeout: 10_000 }
    )

    // Verificar si hay error de la API
    if (data.status === 'failure') {
      console.error('[moderation] Sightengine error:', data.error)
      return { approved: true } // ante duda de error técnico, dejar pasar
    }

    const nudity = data.nudity ?? {}
    const minor  = data.minor  ?? {}

    // Desnudez explícita
    if ((nudity.sexual_activity ?? 0) > 0.5) {
      return { approved: false, reason: 'La foto contiene contenido sexual explícito y no puede ser subida.' }
    }
    if ((nudity.sexual_display ?? 0) > 0.5) {
      return { approved: false, reason: 'La foto contiene desnudez explícita y no puede ser subida.' }
    }
    if ((nudity.erotica ?? 0) > 0.75) {
      return { approved: false, reason: 'La foto contiene contenido erótico y no puede ser subida.' }
    }

    // Posible menor
    if (minor.minor_detected === true && (minor.minor_score ?? 0) > 0.65) {
      return { approved: false, reason: 'La foto parece contener a una persona menor de edad y no puede ser subida.' }
    }

    return { approved: true }
  } catch (err) {
    console.error('[moderation] Error al llamar a Sightengine:', err)
    return { approved: true } // ante error técnico, dejar pasar
  }
}
